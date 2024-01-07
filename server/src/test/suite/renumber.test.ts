import * as config from '../../settings';
import * as lxbase from '../../langExtBase';
import * as com from '../../commands';
import * as assert from 'assert';
import * as vsserv from 'vscode-languageserver';

async function gatherTest(code: string, expected: com.LabelInformation) {
	const TSInitResult = await lxbase.TreeSitterInit();
	const tool = new com.LineNumberTool(TSInitResult, console, config.defaultSettings);
	const tree = tool.parse(code, '\n');
	const actual = tool.get_primary_nums(tree);
	assert.deepStrictEqual(actual, expected);
}

describe('Renumber', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	it('get primary numbers', async function() {
		const testCode = '10 HOME\n20 PRINT hello\n30 GOTO 1000';
		const expected = new com.LabelInformation();
		expected.leading_space.push(0,0,0);
		expected.trailing_space.push(1,1,1);
		expected.rngs.push(vsserv.Range.create(0, 0, 0, 3));
		expected.rngs.push(vsserv.Range.create(1, 0, 1, 3));
		expected.rngs.push(vsserv.Range.create(2, 0, 2, 3));
		expected.nums.push(10, 20, 30);
		await gatherTest(testCode, expected);
	});
});
