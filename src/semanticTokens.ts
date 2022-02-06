import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';
import { LangExtBase } from './langExtBase';

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

export class TSSemanticTokensProvider extends LangExtBase implements vscode.DocumentSemanticTokensProvider
{
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
		if (["string","terminal_string"].indexOf(curs.nodeType)>-1)
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
		if (["intvar","realvar","svar","real_scalar","int_scalar","real_array","int_array","string_array"].indexOf(curs.nodeType)>-1)
		{
			builder.push(rng,"variable",[]);
			return true;
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

		const tree = this.parse(document.getText()+"\n");
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