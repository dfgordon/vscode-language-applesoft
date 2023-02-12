import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';

async function diagnosticTester(progName: string, expectedNumber: number, expectedMessages: RegExp[]) {
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
		assert.strictEqual(diagList.length, expectedNumber);
		for (let i = 0; i < expectedNumber; i++)
			assert.match(diagList[i].message, expectedMessages[i]);
	}
}

describe('Diagnostics', function() {
	it('Undeclared', async function () {
		await diagnosticTester('test-undeclared.abas', 4, [
			/array is never DIM'd/,
			/array is never DIM'd/,
			/array is never DIM'd/,
			/array is never DIM'd/
		]);
	});
	it('Collisions', async function () {
		await diagnosticTester('test-collisions.abas', 3, [
			/variable name collision:\s*PIES,PI/,
			/variable name collision:\s*MYWRD\$,MYCLR\$/,
			/variable name collision:\s*CUBE,CUTE/
		]);
	});
	it('Range Errors', async function () {
		await diagnosticTester('test-ranges.abas', 13, [
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
		await diagnosticTester('test-lines.abas', 8, [
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
		await diagnosticTester('test-functions.abas', 2, [
			/function is redefined/,
			/function never defined/
		]);
	});
	it('Data', async function () {
		await diagnosticTester('test-data.abas', 1, [
			/Odd quote parity in literal on multi-statement line invites trouble/
		]);
	});
});

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}