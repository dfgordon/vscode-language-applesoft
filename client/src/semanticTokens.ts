import * as vscode from 'vscode';
import Parser from 'web-tree-sitter';
import * as lxbase from './langExtBase';

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

export class TSSemanticTokensProvider extends lxbase.LangExtBase implements vscode.DocumentSemanticTokensProvider
{
	tokensBuilder : vscode.SemanticTokensBuilder = new vscode.SemanticTokensBuilder(legend);
	process_node(curs: Parser.TreeCursor): lxbase.WalkerChoice
	{
		const rng = lxbase.curs_to_range(curs);
		if (["comment_text","tok_rem"].indexOf(curs.nodeType)>-1) // must precede tok_ handler
		{
			this.tokensBuilder.push(rng,"comment",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (curs.nodeType.substring(0,4)=="tok_")
		{
			if (funcNames.includes(curs.nodeType.substring(4)))
				this.tokensBuilder.push(rng,"function",[]);
			else
				this.tokensBuilder.push(rng,"keyword",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (curs.nodeType=="linenum")
		{
			this.tokensBuilder.push(rng,"macro",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (["str","terminal_str","data_str","data_literal"].includes(curs.nodeType))
		{
			this.tokensBuilder.push(rng,"string",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (curs.nodeType=="name_fn")
		{
			this.tokensBuilder.push(rng,"function",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (["int","real","data_int","data_real"].includes(curs.nodeType))
		{
			this.tokensBuilder.push(rng,"number",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (curs.nodeType.substring(0,5)=="name_")
		{
			this.tokensBuilder.push(rng,"variable",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		return lxbase.WalkerOptions.gotoChild;
	}
	provideDocumentSemanticTokens(document:vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens>
	{
		this.tokensBuilder = new vscode.SemanticTokensBuilder(legend);

		const tree = this.parse(document.getText(),"\n");
		this.walk(tree,this.process_node.bind(this));
		return this.tokensBuilder.build();
	}
}