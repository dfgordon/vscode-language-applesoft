import * as vsserv from 'vscode-languageserver/node';
import * as vsdoc from 'vscode-languageserver-textdocument';
import Parser from 'web-tree-sitter';
import * as path from 'path';
import { applesoftSettings } from './settings';

export function curs_to_range(curs: Parser.TreeCursor): vsserv.Range
{
	const start_pos = vsserv.Position.create(curs.startPosition.row, curs.startPosition.column);
	const end_pos = vsserv.Position.create(curs.endPosition.row, curs.endPosition.column);
	return vsserv.Range.create(start_pos, end_pos);
}
export function node_to_range(node: Parser.SyntaxNode): vsserv.Range
{
	const start_pos = vsserv.Position.create(node.startPosition.row,node.startPosition.column);
	const end_pos = vsserv.Position.create(node.endPosition.row,node.endPosition.column);
	return vsserv.Range.create(start_pos,end_pos);
}

export function var_to_key(node: Parser.SyntaxNode): string
{
	// node must be var_* in general, can be name_* or name_fn if we are sure this node is not an array
	const nameNode = node.firstNamedChild;
	if (!nameNode)
		return node.text.toUpperCase().replace(/ /g, '');
	const base = nameNode.text.toUpperCase().replace(/ /g, '');
	const subscript = nameNode.nextNamedSibling;
	if (!subscript)
		return base;
	return base + '()';
}

export function name_range(node: Parser.SyntaxNode): vsserv.Range
{
	// node can be either var_* or name_*
	const nameNode = node.firstNamedChild;
	if (!nameNode)
		return node_to_range(node);
	return node_to_range(nameNode);
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
	await Parser.init();
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
	constructor(TSInitResult: [Parser, Parser.Language], settings: applesoftSettings) {
		this.parser = TSInitResult[0];
		this.Applesoft = TSInitResult[1];
		this.config = settings;
	}
	configure(settings: applesoftSettings) {
		this.config = settings;
	}
	lines(document: vsdoc.TextDocument) : string[]
	{
		return document.getText().split('\n');
	}
	parse(txt: string,append: string) : Parser.Tree
	{
		return this.parser.parse(txt+append);
	}
	walk(syntaxTree: Parser.Tree,visit: (node: Parser.TreeCursor) => WalkerChoice)
	{
		const curs = syntaxTree.walk();
		let choice : WalkerChoice = WalkerOptions.gotoChild;
		do
		{
			if (choice==WalkerOptions.gotoChild && curs.gotoFirstChild())
				choice = visit(curs);
			else if (choice==WalkerOptions.gotoParentSibling && curs.gotoParent() && curs.gotoNextSibling())
				choice = visit(curs);
			else if (choice==WalkerOptions.gotoSibling && curs.gotoNextSibling())
				choice = visit(curs);
			else if (curs.gotoNextSibling())
				choice = visit(curs);
			else if (curs.gotoParent())
				choice = WalkerOptions.gotoSibling;
			else
				choice = WalkerOptions.exit;
		} while (choice!=WalkerOptions.exit);
	}
}
