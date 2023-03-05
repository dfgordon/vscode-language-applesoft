import * as config from '../../settings';
import * as lxbase from '../../langExtBase';
import * as com from '../../commands';
import * as assert from 'assert';

async function gatherTest(code: string, expected: number[]) {
	const TSInitResult = await lxbase.TreeSitterInit();
	const tool = new com.LineNumberTool(TSInitResult, config.defaultSettings);
	const tree = tool.parse(code, '\n');
	const actual = tool.get_primary_nums(tree);
	assert.deepStrictEqual(actual, expected);
}

describe('Renumber', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	it('get primary numbers', async function() {
		const testCode = '10 HOME\n20 PRINT hello\n30 GOTO 1000';
		const expected = [10, 20, 30];
		await gatherTest(testCode, expected);
	});
});
