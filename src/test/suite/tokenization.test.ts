import * as vscode from 'vscode';
import * as lxbase from '../../langExtBase';
import * as com from '../../commands';
import * as assert from 'assert';

describe('Tokenization Tests', async function() {
	vscode.window.showInformationMessage('Start tokenization testing');
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tokTool = new com.TokenizationTool(TSInitResult);
	});
	it('single line', function() {
		const testCode = '10 HOME\n';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = new Uint8Array(this.tokTool.buffer_from_raw_str(tokStr));
		const expected = new Uint8Array([7,8,10,0,151,0,0,0]);
		assert.deepStrictEqual(actual,expected);
	});
	it('multi line', function() {
		const testCode = '10 HOME\n20 PRINT "HELLO"';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = new Uint8Array(this.tokTool.buffer_from_raw_str(tokStr));
		const expected = new Uint8Array([
			7,8,10,0,151,0,
			20,8,20,0,186,34,72,69,76,76,79,34,0,0,0]);
		assert.deepStrictEqual(actual,expected);
	});
	it('lower case variable', function() {
		const testCode = '10 HOME\n20 PRINT hello';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = new Uint8Array(this.tokTool.buffer_from_raw_str(tokStr));
		const expected = new Uint8Array([
			7,8,10,0,151,0,
			18,8,20,0,186,72,69,76,76,79,0,0,0]);
		assert.deepStrictEqual(actual,expected);
	});
});
