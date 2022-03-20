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
		const rng = this.curs_to_range(curs);
		if (["comment_text","rem_tok"].indexOf(curs.nodeType)>-1) // must precede _tok handler
		{
			this.tokensBuilder.push(rng,"comment",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (curs.nodeType.slice(-3)=="tok")
		{
			if (funcNames.indexOf(curs.nodeType.slice(0,-4))>-1)
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
		if (["string","terminal_string"].indexOf(curs.nodeType)>-1)
		{
			this.tokensBuilder.push(rng,"string",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (curs.nodeType=="fn_name")
		{
			this.tokensBuilder.push(rng,"function",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (["integer","real","data_integer","data_real"].indexOf(curs.nodeType)>-1)
		{
			this.tokensBuilder.push(rng,"number",[]);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (lxbase.VariableTypes.indexOf(curs.nodeType)>-1)
		{
			this.tokensBuilder.push(this.var_name_range(curs),"variable",[]);
			return lxbase.WalkerOptions.gotoChild;
		}
		if (curs.nodeType=="literal")
		{
			this.tokensBuilder.push(rng,"string",[]);
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