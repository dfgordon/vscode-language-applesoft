import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';

const tokenTypes = [
	'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
	'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
	'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
];
const tokenModifiers = [
	'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
	'modification', 'async'
];
const funcNames = [
	'sgn',
	'int',
	'abs',
	'usr',
	'fre',
	'scrnp',
	'pdl',
	'pos',
	'sqr',
	'rnd',
	'log',
	'exp',
	'cos',
	'sin',
	'tan',
	'atn',
	'peek',
	'len',
	'str',
	'val',
	'asc',
	'chr',
	'left',
	'right',
	'mid'
];

export const legend = new vscode.SemanticTokensLegend(tokenTypes,tokenModifiers);

export class TSSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider
{
	parser : Parser;

	constructor(parser: Parser)
	{
		this.parser = parser;
	}
	curs_to_range(curs: Parser.TreeCursor): vscode.Range
	{
		const start_pos = new vscode.Position(curs.startPosition.row,curs.startPosition.column);
		const end_pos = new vscode.Position(curs.endPosition.row,curs.endPosition.column);
		return new vscode.Range(start_pos,end_pos);
	}	
	process_node(builder: vscode.SemanticTokensBuilder,curs: Parser.TreeCursor): boolean
	{
		const rng = this.curs_to_range(curs);
		if (["comment_text","rem_tok"].indexOf(curs.nodeType)>-1) // must precede _tok handler
		{
			builder.push(rng,"comment",[]);
			return false;
		}
		if (curs.nodeType.slice(-3)=="tok")
		{
			if (funcNames.indexOf(curs.nodeType.slice(0,-4))>-1)
				builder.push(rng,"function",[]);
			else
				builder.push(rng,"keyword",[]);
			return false;
		}
		if (curs.nodeType=="linenum")
		{
			builder.push(rng,"macro",[]);
			return false;
		}
		if (curs.nodeType=="string")
		{
			builder.push(rng,"string",[]);
			return false;
		}
		if (curs.nodeType=="fn_name")
		{
			builder.push(rng,"function",[]);
			return false;
		}
		if (["integer","real"].indexOf(curs.nodeType)>-1)
		{
			builder.push(rng,"number",[]);
			return false;
		}
		if (["intvar","realvar","svar","real_scalar","int_scalar"].indexOf(curs.nodeType)>-1)
		{
			builder.push(rng,"variable",[]);
			return false;
		}
		if (curs.nodeType=="literal")
		{
			builder.push(rng,"string",[]);
			return false;
		}
		return true;
	}
	provideDocumentSemanticTokens(document:vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens>
	{

		const tokensBuilder = new vscode.SemanticTokensBuilder(legend);

		const tree = this.parser.parse(document.getText());
		const cursor = tree.walk();
		let recurse = true;
		let finished = false;
		do
		{
			if (recurse && cursor.gotoFirstChild())
				recurse = this.process_node(tokensBuilder,cursor);
			else
			{
				if (cursor.gotoNextSibling())
					recurse = this.process_node(tokensBuilder,cursor);
				else if (cursor.gotoParent())
					recurse = false;
				else
					finished = true;
			}
		} while (!finished);

		return tokensBuilder.build();
	}
}