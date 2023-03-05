import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';

async function diagnosticTester(progName: string, expectedMessages: RegExp[]) {
	while (vscode.window.activeTextEditor)
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor", vscode.window.activeTextEditor.document.uri);
	const progPath = path.resolve(__dirname, '..', '..', '..', '..', 'sample', progName);
	const doc = await vscode.workspace.openTextDocument(progPath);
	const ed = await vscode.window.showTextDocument(doc);
	if (!ed)
		assert.fail('no active text editor');
	let collections: [vscode.Uri,vscode.Diagnostic[]][];
	do {
		collections = vscode.languages.getDiagnostics();
	} while (!collections);
	for (const collection of collections)
	{
		if (collection[0].path!=doc.uri.path)
			continue;
		const diagList = collection[1];
		assert.strictEqual(diagList.length, expectedMessages.length);
		for (let i = 0; i < expectedMessages.length; i++)
			assert.match(diagList[i].message, expectedMessages[i]);
	}
}

describe('Diagnostics', function() {
	it('Undeclared', async function () {
		await diagnosticTester('test-undeclared.abas', [
			/array is never DIM'd/,
			/array is never DIM'd/,
			/array is never DIM'd/,
			/array is never DIM'd/,
			/array is never DIM'd/
		]);
	});
	it('Unassigned', async function () {
		await diagnosticTester('test-unassigned.abas', [
			/variable is never assigned/,
			/variable is never assigned/,
			/variable is never assigned/,
			/variable is never assigned/
		]);
	});
	it('Collisions', async function () {
		await diagnosticTester('test-collisions.abas', [
			/variable name collision:\s*PIES,PI/,
			/variable name collision:\s*MYWRD\$,MYCLR\$/,
			/variable name collision:\s*CUBE,CUTE/
		]);
	});
	it('Range Errors', async function () {
		await diagnosticTester('test-ranges.abas', [
			/Out of range \(0,63999\)/,
			/Out of range \(-1\.7e\+38,1\.7e\+38\)/,
			/Out of range \(-32767,32767\)/,
			/Out of range \(0,7\)/,
			/Out of range \(-32767,65535\)/,
			/Out of range \(0,255\)/,
			/Out of range \(-32767,65535\)/,
			/Out of range \(-32767,65535\)/,
			/Out of range \(-32767,65535\)/,
			/Out of range \(-32767,65535\)/,
			/Out of range \(-32767,65535\)/,
			/Out of range \(0,255\)/,
			/Out of range \(0,255\)/
		]);
	});
	it('Line Numbers', async function () {
		await diagnosticTester('test-lines.abas', [
			/Line number out of order/,
			/\(ERROR \(tok_minus\)\)/,
			/Line does not exist/,
			/Line does not exist/,
			/Line does not exist/,
			/Line does not exist/,
			/Line does not exist/,
			/Line does not exist/
		]);
	});
	it('User Functions', async function () {
		await diagnosticTester('test-functions.abas', [
			/function is redefined/,
			/function never defined/
		]);
	});
	it('Data', async function () {
		await diagnosticTester('test-data.abas', [
			/Odd quote parity in literal on multi-statement line invites trouble/
		]);
	});
});

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}