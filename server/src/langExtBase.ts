import * as vsserv from 'vscode-languageserver/node';
import * as vsdoc from 'vscode-languageserver-textdocument';
import Parser from 'web-tree-sitter';
import * as path from 'path';
import { applesoftSettings } from './settings';

function is_hex(x: number): boolean
{
	return x >= 48 && x <= 57 || x >= 65 && x <= 70 || x >= 97 && x <= 102;
}

/**
 * Escape the bytes in some stringlike context
 * @param escapes byte values that should be escaped, all values > 126 are escaped unconditionally
 * @param bytes bytes to escape, literal hex escapes will hex-escape the backslash (`\x5c`)
 * @param offset index to start of this context, one past the triggering byte
 * @param terminator characters that close the context
 * @param ctx string indicating the context, `str` node, `tok_data` node, `tok_rem` node
 * @returns escaped string and index to the terminator, terminator is not included in string
 */
export function bytes_to_escaped_string(escapes: number[], bytes: number[], offset: number, terminator: number[], ctx: string): [string,number]
{
	const QUOTE = 34;
	const BACKSLASH = 92;
	let ans = "";
	let idx = offset;
	let quotes = 0;
	if (ctx == "str") {
		quotes++;
	}
	while (idx < bytes.length) {
		if (ctx == "tok_data" && bytes[idx] == 0)
			break;
		if (ctx == "tok_data" && quotes % 2 == 0 && terminator.includes(bytes[idx]))
			break;
		if (ctx != "tok_data" && terminator.includes(bytes[idx]))
			break;
		if (bytes[idx] == QUOTE)
			quotes++;
		if (bytes[idx] == BACKSLASH && idx + 3 < bytes.length) {
			if (bytes[idx + 1] == 120 && is_hex(bytes[idx + 2]) && is_hex(bytes[idx + 3]))
				ans += "\\x5c";
			else
				ans += "\\";
		}
		else if (escapes.includes(bytes[idx]) || bytes[idx] > 126)
			ans += '\\x' + bytes[idx].toString(16).padStart(2,'0'); 
		else
			ans += String.fromCharCode(bytes[idx]);
		idx += 1;
	}
	return [ans,idx];
}

export function escaped_string_to_raw_str(txt: string): string  {
	const seq1 = [/\\/, /x/, /[0-9a-fA-F]/, /[0-9a-fA-F]/];
	let ans = "";
	let matches1 = 0;
	let stack = "";
	for (let i = 0; i < txt.length; i++) {
		let matching = false;
		if (txt.charAt(i).search(seq1[matches1])>=0) {
			matches1++;
			matching = true;
		} else {
			matches1 = 0;
		}
		if (matching)
			stack += txt.charAt(i);
		else {
			if (stack.length > 0) {
				ans += stack;
				stack = "";
				i--;
			} else {
				ans += txt.charAt(i);
			}
		}
		if (matches1 == 4) {
			ans += String.fromCharCode(parseInt(txt.slice(i-1,i+1),16));
			matches1 = 0;
			stack = "";
		}
	}
	ans += stack;
	return ans;
}

export function curs_to_range(curs: Parser.TreeCursor,row: number): vsserv.Range
{
	const start_pos = vsserv.Position.create(row+curs.startPosition.row, curs.startPosition.column);
	const end_pos = vsserv.Position.create(row+curs.endPosition.row, curs.endPosition.column);
	return vsserv.Range.create(start_pos, end_pos);
}
export function node_to_range(node: Parser.SyntaxNode,row: number): vsserv.Range
{
	const start_pos = vsserv.Position.create(row+node.startPosition.row,node.startPosition.column);
	const end_pos = vsserv.Position.create(row+node.endPosition.row,node.endPosition.column);
	return vsserv.Range.create(start_pos,end_pos);
}

/**
 * Extract variable name from syntax node
 * @param node syntax node to be analyzed, can be var_* or name_*, except for name_amp
 * @param recall is this an implicit array like the argument of RECALL
 * @returns [normalized name,specific name]
 */
export function var_to_key(node: Parser.SyntaxNode,recall: boolean): [string,string]
{
	const nameNode = node.firstNamedChild ? node.firstNamedChild : node;
	let n = nameNode.text.replace(/ /g, '');
	if (nameNode.nextNamedSibling?.type=="subscript" || recall)
		n += '()';
	return [n.toUpperCase(),n];
}

/**
 * Extract range of the variable name within the node
 * @param node node can be either var_* or name_*
 * @param row row value to add when processing line by line
 * @returns range of 
 */
export function name_range(node: Parser.SyntaxNode,row: number): vsserv.Range
{
	const nameNode = node.firstNamedChild;
	if (!nameNode)
		return node_to_range(node,row);
	return node_to_range(nameNode,row);
}

export const WalkerOptions = {
	gotoChild: 0,
	gotoSibling: 1,
	gotoParentSibling: 2,
	exit: 3
} as const;

export type WalkerChoice = typeof WalkerOptions[keyof typeof WalkerOptions];

export async function TreeSitterInit(): Promise<[Parser,Parser.Language]>
{
	await Parser.init({
		locateFile(scriptName: string, scriptDirectory: string) {
			return path.join(__dirname,'tree-sitter.wasm');
		}
	});
	const parser = new Parser();
	const Applesoft = await Parser.Language.load(path.join(__dirname,'tree-sitter-applesoft.wasm'));
	parser.setLanguage(Applesoft);
	return [parser,Applesoft];
}

export function rangeContainsPos(rng: vsserv.Range, pos: vsserv.Position) : boolean // is this built in somewhere?
{
	if (pos.line < rng.start.line || pos.line > rng.end.line)
		return false;
	if (pos.line == rng.start.line && pos.character < rng.start.character)
		return false;
	if (pos.line == rng.end.line && pos.character > rng.end.character)
		return false;
	return true;
}

export function rangeContainsRange(outer: vsserv.Range, inner: vsserv.Range) : boolean // is this built in somewhere?
{
	if (inner.start.line < outer.start.line || inner.end.line > outer.end.line)
		return false;
	if (inner.start.line == outer.start.line && inner.start.character < outer.start.character)
		return false;
	if (inner.end.line == outer.end.line && inner.end.character > outer.end.character)
		return false;
	return true;
}

export class LangExtBase {
	parser: Parser;
	Applesoft: Parser.Language;
	config: applesoftSettings;
	depth: number;
	constructor(TSInitResult: [Parser, Parser.Language], settings: applesoftSettings) {
		this.parser = TSInitResult[0];
		this.Applesoft = TSInitResult[1];
		this.config = settings;
		this.depth = 0;
	}
	configure(settings: applesoftSettings) {
		this.config = settings;
	}
	lines(document: vsdoc.TextDocument) : string[]
	{
		return document.getText().split(/\r?\n/);
	}
	parse(txt: string,append: string) : Parser.Tree
	{
		return this.parser.parse(txt+append);
	}
	walk(syntaxTree: Parser.Tree,visit: (node: Parser.TreeCursor) => WalkerChoice)
	{
		this.depth = 0;
		const curs = syntaxTree.walk();
		let choice : WalkerChoice = WalkerOptions.gotoChild;
		do
		{
			if (choice == WalkerOptions.gotoChild && curs.gotoFirstChild()) {
				this.depth++;
				choice = visit(curs);
			}
			else if (choice == WalkerOptions.gotoParentSibling && curs.gotoParent() && curs.gotoNextSibling()) {
				this.depth--;
				choice = visit(curs);
			}
			else if (choice==WalkerOptions.gotoSibling && curs.gotoNextSibling())
				choice = visit(curs);
			else if (curs.gotoNextSibling())
				choice = visit(curs);
			else if (curs.gotoParent()) {
				this.depth--;
				choice = WalkerOptions.gotoSibling;
			}
			else
				choice = WalkerOptions.exit;
		} while (choice!=WalkerOptions.exit);
	}
}
