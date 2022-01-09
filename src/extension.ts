import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';
import * as path from 'path';
import { TSHoverProvider } from './hovers';
import { TSDiagnosticProvider } from './diagnostics';
import { TSSemanticTokensProvider, legend } from './semanticTokens';
import { LineCompletionProvider, TSCompletionProvider } from './completions';

async function TreeSitterInit(): Promise<Parser>
{
	const config = vscode.workspace.getConfiguration('applesoft');
	let pathToLang = config.get('caseSensitive') ? '-case-sens.wasm' : '.wasm';
	await Parser.init();
	const parser = new Parser();
	pathToLang = path.join(__dirname,'../tree-sitter-applesoft' + pathToLang);
	const Applesoft = await Parser.Language.load(pathToLang);
	parser.setLanguage(Applesoft);
	return parser;
}

/// This function runs when the extension loads.
/// It creates the parser object and sets up the providers.
export function activate(context: vscode.ExtensionContext)
{
	TreeSitterInit().then( parser =>
	{
		const selector = { language: 'applesoft' };
		const collection = vscode.languages.createDiagnosticCollection('applesoft-file');
		const diagnostics = new TSDiagnosticProvider(parser);
		const tokens = new TSSemanticTokensProvider(parser);
		const hovers = new TSHoverProvider(parser);
		const completions = new TSCompletionProvider();
		const lineCompletions = new LineCompletionProvider();
		if (vscode.window.activeTextEditor)
		{
			diagnostics.update(vscode.window.activeTextEditor.document, collection);
		}
		vscode.languages.registerDocumentSemanticTokensProvider(selector,tokens,legend);
		vscode.languages.registerHoverProvider(selector,hovers);
		vscode.languages.registerCompletionItemProvider(selector,completions);
		vscode.languages.registerCompletionItemProvider(selector,lineCompletions,'\n');

		context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor =>
		{
			if (editor)
			{
				diagnostics.update(editor.document, collection);
			}
		}));
		context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(editor =>
		{
			if (editor)
			{
				diagnostics.update(editor.document, collection);
			}
		}));
	});
}
