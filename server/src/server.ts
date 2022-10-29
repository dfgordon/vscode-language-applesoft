import * as vsserv from 'vscode-languageserver/node';
import * as vsdoc from 'vscode-languageserver-textdocument';
import * as diag from './diagnostics';
import * as comm from './commands';
import * as hov from './hovers';
import * as compl from './completions';
import * as lxbase from './langExtBase';
import * as Parser from 'web-tree-sitter';
import { defaultSettings } from './settings';

let globalSettings = defaultSettings;
let TSInitResult: [Parser, Parser.Language];
let diagnosticTool: diag.TSDiagnosticProvider;
let hoverTool: hov.TSHoverProvider;
let statementTool: compl.StatementCompletionProvider;
let addressTool: compl.AddressCompletionProvider;
let lineCompleter: compl.LineCompletionProvider;
let minifier: comm.Minifier;
let tokenizer: comm.Tokenizer;
let renumberer: comm.LineNumberTool;

export interface Lines {
	rem: string | undefined;
	primary: vsserv.Range;
	gosubs: vsserv.Range[];
	gotos: vsserv.Range[];
}

export interface Variable {
	dec: vsserv.Range[];
	def: vsserv.Range[];
	ref: vsserv.Range[];
}

export class DocSymbols {
	lines = new Map<number,Lines>();
	functions = new Map<string,Variable>();
	scalars = new Map<string,Variable>();
	arrays = new Map<string,Variable>();
}

export let docSymbols = new DocSymbols();

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = vsserv.createConnection(vsserv.ProposedFeatures.all);

// Create a simple text document manager.
const documents: vsserv.TextDocuments<vsdoc.TextDocument> = new vsserv.TextDocuments(vsdoc.TextDocument);

async function startServer()
{
	documents.listen(connection);
	connection.listen();
	TSInitResult = await lxbase.TreeSitterInit();
	globalSettings = await connection.workspace.getConfiguration('applesoft');
	diagnosticTool = new diag.TSDiagnosticProvider(TSInitResult, globalSettings);
	hoverTool = new hov.TSHoverProvider(TSInitResult, globalSettings);
	statementTool = new compl.StatementCompletionProvider(TSInitResult, globalSettings);
	addressTool = new compl.AddressCompletionProvider(TSInitResult, globalSettings);
	lineCompleter = new compl.LineCompletionProvider(TSInitResult, globalSettings);
	minifier = new comm.Minifier(TSInitResult, globalSettings);
	tokenizer = new comm.Tokenizer(TSInitResult, globalSettings);
	renumberer = new comm.LineNumberTool(TSInitResult, globalSettings);
}

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: vsserv.InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: vsserv.InitializeResult = {
		capabilities: {
			textDocumentSync: vsserv.TextDocumentSyncKind.Full,
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['\n',' ']
			},
			declarationProvider: true,
			definitionProvider: true,
			referencesProvider: true,
			hoverProvider: true,
			documentSymbolProvider: true,
			renameProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(vsserv.DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

connection.onDidChangeConfiguration(change => {
	connection.workspace.getConfiguration('applesoft').then(settings => {
		globalSettings = settings;
		diagnosticTool.configure(globalSettings);
		hoverTool.configure(globalSettings);
		statementTool.configure(globalSettings);
		addressTool.configure(globalSettings);
		lineCompleter.configure(globalSettings);
		minifier.configure(globalSettings);
		tokenizer.configure(globalSettings);
		renumberer.configure(globalSettings);
	}).then(() => {
		// Revalidate all open text documents
		// TODO: for this to work we might need to store DocSymbols for all open documents
		documents.all().forEach(validateTextDocument);
	});
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

connection.onDeclaration(params => {
	for (const [name, vars] of docSymbols.arrays) {
		for (const rng of vars.ref)
			if (lxbase.rangeContainsPos(rng, params.position)) {
				const ans = new Array<vsserv.Location>();
				for (const decRange of vars.dec)
					ans.push(vsserv.Location.create(params.textDocument.uri, decRange));
				return ans;
			}
	}
});

connection.onDefinition(params => {
	for (const [num, line] of docSymbols.lines) {
		for (const rng of line.gosubs.concat(line.gotos))
			if (lxbase.rangeContainsPos(rng, params.position))
				return [vsserv.Location.create(params.textDocument.uri, line.primary)];
	}
	for (const [name, vars] of docSymbols.scalars) {
		for (const rng of vars.ref)
			if (lxbase.rangeContainsPos(rng, params.position)) {
				const ans = new Array<vsserv.Location>();
				for (const defRange of vars.def)
					ans.push(vsserv.Location.create(params.textDocument.uri, defRange));
				return ans;
			}
	}
	for (const [name, vars] of docSymbols.arrays) {
		for (const rng of vars.ref)
			if (lxbase.rangeContainsPos(rng, params.position)) {
				const ans = new Array<vsserv.Location>();
				for (const defRange of vars.def)
					ans.push(vsserv.Location.create(params.textDocument.uri, defRange));
				return ans;
			}
	}
	for (const [name, funcs] of docSymbols.functions) {
		for (const rng of funcs.ref)
			if (lxbase.rangeContainsPos(rng, params.position)) {
				const ans = new Array<vsserv.Location>();
				for (const defRange of funcs.def)
					ans.push(vsserv.Location.create(params.textDocument.uri, defRange));
				return ans;
			}
	}
});

connection.onDocumentSymbol(params => {
	const ans = new Array<vsserv.DocumentSymbol>();
	for (const [num, line] of docSymbols.lines) {
		if (line.gosubs.length > 0)
			ans.push(vsserv.DocumentSymbol.create(num.toString(), line.rem, vsserv.SymbolKind.Function, line.primary, line.primary));
		else if (line.gotos.length > 0)
			ans.push(vsserv.DocumentSymbol.create(num.toString(), line.rem, vsserv.SymbolKind.Constant, line.primary, line.primary));
	}
	for (const [name, vars] of docSymbols.arrays) {
		for (const rng of vars.dec)
			ans.push(vsserv.DocumentSymbol.create(name.substring(0,name.length-2), undefined, vsserv.SymbolKind.Array, rng, rng));
		for (const rng of vars.def)
			ans.push(vsserv.DocumentSymbol.create(name.substring(0,name.length-2), undefined, vsserv.SymbolKind.Array, rng, rng));
	}
	for (const [name, vars] of docSymbols.functions) {
		for (const rng of vars.def)
			ans.push(vsserv.DocumentSymbol.create(name, undefined, vsserv.SymbolKind.Function, rng, rng));
	}
	for (const [name, vars] of docSymbols.scalars) {
		for (const rng of vars.def)
			if (name.slice(-1)=='$')
				ans.push(vsserv.DocumentSymbol.create(name, undefined, vsserv.SymbolKind.String, rng, rng));
			else
				ans.push(vsserv.DocumentSymbol.create(name, undefined, vsserv.SymbolKind.Variable, rng, rng));
	}
	return ans;
});

function referencesFromVariable(map: Map<string,Variable>, params: vsserv.ReferenceParams): Array<vsserv.Location> | undefined {
	for (const [name, vars] of map) {
		const ans = new Array<vsserv.Location>();
		let clicked = false;
		for (const rng of vars.ref) {
			ans.push(vsserv.Location.create(params.textDocument.uri, rng));
			clicked = clicked || lxbase.rangeContainsPos(rng, params.position);
		}
		if (clicked)
			return ans;
	}
}

connection.onReferences(params => {
	for (const [num, line] of docSymbols.lines) {
		const ans = new Array<vsserv.Location>();
		let clicked = false;
		for (const rng of line.gosubs.concat(line.gotos).concat(line.primary)) {
			ans.push(vsserv.Location.create(params.textDocument.uri, rng));
			clicked = clicked || lxbase.rangeContainsPos(rng, params.position);
		}
		if (clicked)
			return ans;
	}
	for (const map of [docSymbols.scalars, docSymbols.arrays, docSymbols.functions]) {
		const ans = referencesFromVariable(map, params);
		if (ans)
			return ans;
	}
});

connection.onHover(params => {
	if (hoverTool)
	{
		return hoverTool.provideHover(documents.get(params.textDocument.uri), params.position);
	}
});

connection.onCompletion((params: vsserv.CompletionParams): vsserv.CompletionItem[] => {
	let ans = new Array<vsserv.CompletionItem>();
	if (statementTool && params.context?.triggerKind==1)
	{
		ans = ans.concat(statementTool.provideCompletionItems(documents.get(params.textDocument.uri), params.position));	
	}
	if (addressTool && params.context?.triggerCharacter==' ')
	{
		ans = ans.concat(addressTool.provideCompletionItems(documents.get(params.textDocument.uri), params.position));	
	}
	if (lineCompleter && params.context?.triggerCharacter=='\n')
	{
		ans = ans.concat(lineCompleter.provideCompletionItems(documents.get(params.textDocument.uri), params.position));	
	}
	return ans;
});

function findRenamable(map: Map<string,Variable>, params: vsserv.RenameParams): Array<vsserv.Location> | undefined {
	for (const [name, vars] of map) {
		const ans = new Array<vsserv.Location>();
		let clicked = false;
		for (const rng of vars.ref) {
			ans.push(vsserv.Location.create(params.textDocument.uri, rng));
			clicked = clicked || lxbase.rangeContainsPos(rng, params.position);
		}
		if (clicked) {
			return ans;
		}
	}
}

connection.onRenameRequest((params: vsserv.RenameParams): vsserv.WorkspaceEdit | undefined => {
	for (const map of [docSymbols.scalars, docSymbols.arrays, docSymbols.functions]) {
		const locs = findRenamable(map, params);
		if (locs) {
			const edits = new Array<vsserv.TextEdit>();
			for (const loc of locs) {
				edits.push(vsserv.TextEdit.replace(loc.range, params.newName));
			}
			return { changes: { [params.textDocument.uri]: edits } };
		}
	}
});

connection.onExecuteCommand((params: vsserv.ExecuteCommandParams): any => {
	if (params.command == 'applesoft.minify') {
		if (params.arguments)
			return minifier.minify(params.arguments[0]);
	}
	else if (params.command == 'applesoft.tokenize') {
		if (params.arguments)
			return tokenizer.tokenize(params.arguments[0],params.arguments[1]);
	}
	else if (params.command == 'applesoft.detokenize') {
		if (params.arguments)
			return tokenizer.detokenize(params.arguments);
	}
	else if (params.command == 'applesoft.renumber') {
		if (params.arguments) {
			const doc: vsserv.TextDocumentItem = params.arguments[0];
			const sel: vsserv.Range | null = params.arguments[1];
			const start: string = params.arguments[2];
			const step: string = params.arguments[3];
			const updateRefs: boolean = params.arguments[4];
			const result = renumberer.renumber(doc, sel, start, step, updateRefs);
			if (result[0])
				connection.workspace.applyEdit({ documentChanges: [result[0]] });
			return result[1];
		}
	}
});

async function validateTextDocument(textDocument: vsdoc.TextDocument): Promise<void> {
	while (!diagnosticTool) {
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	const diagnostics = diagnosticTool.update(textDocument);
	docSymbols = diagnosticTool.workingSymbols;
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

startServer();
