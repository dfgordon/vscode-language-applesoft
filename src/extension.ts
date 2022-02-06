import * as vscode from 'vscode';
import { TreeSitterInit } from './langExtBase';
import { TSHoverProvider } from './hovers';
import { TSDiagnosticProvider } from './diagnostics';
import { TSSemanticTokensProvider, legend } from './semanticTokens';
import * as completions from './completions';
import * as com from './commands';

/// This function runs when the extension loads.
/// It creates the parser object and sets up the providers.
export function activate(context: vscode.ExtensionContext)
{
	TreeSitterInit().then( TSInitResult =>
	{
		const selector = { language: 'applesoft' };
		const collection = vscode.languages.createDiagnosticCollection('applesoft-file');
		const diagnostics = new TSDiagnosticProvider(TSInitResult);
		const tokens = new TSSemanticTokensProvider(TSInitResult);
		const hovers = new TSHoverProvider(TSInitResult);
		const snippetCompletions = new completions.TSCompletionProvider();
		const lineCompletions = new completions.LineCompletionProvider();
		const addressCompletions = new completions.AddressCompletionProvider();
		const renumberer = new com.RenumberTool(TSInitResult);
		if (vscode.window.activeTextEditor)
		{
			diagnostics.update(vscode.window.activeTextEditor.document, collection);
		}
		vscode.languages.registerDocumentSemanticTokensProvider(selector,tokens,legend);
		vscode.languages.registerHoverProvider(selector,hovers);
		vscode.languages.registerCompletionItemProvider(selector,snippetCompletions);
		vscode.languages.registerCompletionItemProvider(selector,lineCompletions,'\n');
		vscode.languages.registerCompletionItemProvider(selector,addressCompletions,' ');

		context.subscriptions.push(vscode.commands.registerCommand("applesoft.runNewVii",com.runNewVirtualII));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.runFrontVii",com.runFrontVirtualII));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.enterNewVii",com.enterNewVirtualII));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.enterFrontVii",com.enterFrontVirtualII));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.getFrontVii",com.getFrontVirtualII));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.getAppleWinSaveState",com.getAppleWinSaveState));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.renumber",renumberer.command,renumberer));
		context.subscriptions.push(vscode.commands.registerTextEditorCommand("applesoft.commentLines",com.commentLinesCommand));

		context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor)
				diagnostics.update(editor.document, collection);
		}));
		context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(editor => {
			if (editor)
				diagnostics.update(editor.document, collection);
		}));
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(listener => {
			if (listener)
				addressCompletions.rebuild();
		}));
	});
}
