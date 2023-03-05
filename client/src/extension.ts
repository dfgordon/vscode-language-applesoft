import * as vscode from 'vscode';
import * as tok from './semanticTokens';
import * as com from './commands';
import * as dimg from './diskImage';
import * as lxbase from './langExtBase';
import * as vsclnt from 'vscode-languageclient/node';
import * as path from 'path';

export let client: vsclnt.LanguageClient;

/// This function runs when the extension loads.
/// It creates the parser object and sets up the providers.
export function activate(context: vscode.ExtensionContext)
{
	const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
	const serverOptions: vsclnt.ServerOptions = {
		run: { module: serverModule, transport: vsclnt.TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: vsclnt.TransportKind.ipc,
			options: debugOptions
		}
	};
	const clientOptions: vsclnt.LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'applesoft' }],
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	client = new vsclnt.LanguageClient('applesoft', 'Applesoft BASIC', serverOptions, clientOptions);
	client.start();
	lxbase.TreeSitterInit().then( TSInitResult =>
	{
		const selector = { language: 'applesoft' };
		const renumberer = new com.RenumberTool(TSInitResult);
		const viiEntry = new com.ViiEntryTool(TSInitResult);
		const appleWin = new com.AppleWinTool(TSInitResult);
		const a2kit = new dimg.A2KitTool(TSInitResult);
		const tokenizer = new com.TokenizationTool(TSInitResult);
		const highlighter = new tok.TSSemanticTokensProvider(TSInitResult);
		vscode.languages.registerDocumentSemanticTokensProvider(selector, highlighter, tok.legend);

		context.subscriptions.push(vscode.commands.registerCommand("applesoft.runNewVii",viiEntry.runNewVirtualII,viiEntry));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.runFrontVii",viiEntry.runFrontVirtualII,viiEntry));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.enterNewVii",viiEntry.enterNewVirtualII,viiEntry));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.enterFrontVii",viiEntry.enterFrontVirtualII,viiEntry));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.getFrontVii",viiEntry.getFrontVirtualII,viiEntry));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.getAppleWinSaveState",appleWin.getAppleWinSaveState,appleWin));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.setAppleWinSaveState", appleWin.setAppleWinSaveState, appleWin));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.getFromDiskImage", a2kit.getApplesoftFile, a2kit));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.saveToDiskImage", a2kit.putApplesoftFile, a2kit));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.showTokenizedProgram",tokenizer.showTokenizedProgram,tokenizer));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.renumber", renumberer.command, renumberer));
		context.subscriptions.push(vscode.commands.registerCommand("applesoft.minify", tokenizer.minify_program, tokenizer));
		context.subscriptions.push(vscode.commands.registerTextEditorCommand("applesoft.commentLines",com.commentLinesCommand));
	});
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
