import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';
import * as path from 'path';
import { TSHoverProvider } from './hovers';
import { TSDiagnosticProvider } from './diagnostics';
import { TSSemanticTokensProvider, legend } from './semanticTokens';
import { LineCompletionProvider, TSCompletionProvider } from './completions';
import * as com from './commands';

async function TreeSitterInit(): Promise<Array<Parser>>
{
	const config = vscode.workspace.getConfiguration('applesoft');
	await Parser.init();
	const parser = new Parser();
	const Applesoft = await Parser.Language.load(path.join(__dirname,'../tree-sitter-applesoft.wasm'));
	parser.setLanguage(Applesoft);
	const caseSensitiveParser = new Parser();
	const ApplesoftCaseSens = await Parser.Language.load(path.join(__dirname,'../tree-sitter-applesoft-case-sens.wasm'));
	caseSensitiveParser.setLanguage(ApplesoftCaseSens);
	return [parser,caseSensitiveParser];
}

/// This function runs when the extension loads.
/// It creates the parser object and sets up the providers.
export function activate(context: vscode.ExtensionContext)
{
	TreeSitterInit().then( parsers =>
	{
		const selector = { language: 'applesoft' };
		const collection = vscode.languages.createDiagnosticCollection('applesoft-file');
		const diagnostics = new TSDiagnosticProvider(parsers[0],parsers[1]);
		const tokens = new TSSemanticTokensProvider(parsers[0],parsers[1]);
		const hovers = new TSHoverProvider(parsers[0],parsers[1]);
		const completions = new TSCompletionProvider();
		const lineCompletions = new LineCompletionProvider();
		const renumberer = new com.RenumberTool(parsers[0],parsers[1]);
		if (vscode.window.activeTextEditor)
		{
			diagnostics.update(vscode.window.activeTextEditor.document, collection);
		}
		vscode.languages.registerDocumentSemanticTokensProvider(selector,tokens,legend);
		vscode.languages.registerHoverProvider(selector,hovers);
		vscode.languages.registerCompletionItemProvider(selector,completions);
		vscode.languages.registerCompletionItemProvider(selector,lineCompletions,'\n');

		context.subscriptions.push(vscode.commands.registerCommand("applesoft.runNewVii",com.runNewVirtualII));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.runFrontVii",com.runFrontVirtualII));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.enterNewVii",com.enterNewVirtualII));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.enterFrontVii",com.enterFrontVirtualII));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.renumber",renumberer.command,renumberer));
		context.subscriptions.push(vscode.commands.registerTextEditorCommand("applesoft.commentLines",com.commentLinesCommand));
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
