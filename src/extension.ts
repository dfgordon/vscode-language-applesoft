import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';
import * as path from 'path';

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

const legend = new vscode.SemanticTokensLegend(tokenTypes,tokenModifiers);

Parser.init().then(() =>
{
	const parser = new Parser();
	const pathToLang = path.join(__dirname,'../tree-sitter-applesoft.wasm');
	Parser.Language.load(pathToLang).then(result =>
	{
		const Applesoft = result;
		parser.setLanguage(Applesoft);

		function process_node(builder: vscode.SemanticTokensBuilder,curs: Parser.TreeCursor): boolean
		{
			const start_pos = new vscode.Position(curs.startPosition.row,curs.startPosition.column);
			const end_pos = new vscode.Position(curs.endPosition.row,curs.endPosition.column);
			if (["comment_text","rem_tok"].indexOf(curs.nodeType)>-1) // must precede _tok handler
			{
				builder.push(new vscode.Range(start_pos,end_pos),"comment",[]);
				return false;
			}
			if (curs.nodeType.slice(-3)=="tok")
			{
				if (funcNames.indexOf(curs.nodeType.slice(0,-4))>-1)
					builder.push(new vscode.Range(start_pos,end_pos),"function",[]);
				else
					builder.push(new vscode.Range(start_pos,end_pos),"keyword",[]);
				return false;
			}
			if (curs.nodeType=="linenum")
			{
				builder.push(new vscode.Range(start_pos,end_pos),"macro",[]);
				return false;
			}
			if (curs.nodeType=="string")
			{
				builder.push(new vscode.Range(start_pos,end_pos),"string",[]);
				return false;
			}
			if (curs.nodeType=="fn_name")
			{
				builder.push(new vscode.Range(start_pos,end_pos),"function",[]);
				return false;
			}
			if (["integer","real"].indexOf(curs.nodeType)>-1)
			{
				builder.push(new vscode.Range(start_pos,end_pos),"number",[]);
				return false;
			}
			if (["intvar","realvar","svar","real_scalar","int_scalar"].indexOf(curs.nodeType)>-1)
			{
				builder.push(new vscode.Range(start_pos,end_pos),"variable",[]);
				return false;
			}
			if (curs.nodeType=="literal")
			{
				builder.push(new vscode.Range(start_pos,end_pos),"string",[]);
				return false;
			}
			return true;
		}

		const provider: vscode.DocumentSemanticTokensProvider =
		{
			provideDocumentSemanticTokens(document:vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens>
			{

				const tokensBuilder = new vscode.SemanticTokensBuilder(legend);

				const tree = parser.parse(document.getText());
				const cursor = tree.walk();
				let recurse = true;
				let finished = false;
				do
				{
					if (recurse && cursor.gotoFirstChild())
						recurse = process_node(tokensBuilder,cursor);
					else
					{
						if (cursor.gotoNextSibling())
							recurse = process_node(tokensBuilder,cursor);
						else if (cursor.gotoParent())
							recurse = false;
						else
							finished = true;
					}
				} while (!finished);

				return tokensBuilder.build();
			}
		};

		const selector = { language: 'applesoft', scheme: 'file' };

		vscode.languages.registerDocumentSemanticTokensProvider(selector,provider,legend);
	});
});