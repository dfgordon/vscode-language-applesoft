import * as config from '../../settings';
import * as lxbase from '../../langExtBase';
import * as com from '../../commands';
import * as assert from 'assert';

describe('Renumber', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tool = new com.LineNumberTool(TSInitResult,config.defaultSettings);
	});
	it('get primary numbers', function() {
		const testCode = '10 HOME\n20 PRINT hello\n30 GOTO 1000';
		const tree = this.tool.parse(testCode,'\n');
		const nums = this.tool.get_primary_nums(tree);
		assert.deepStrictEqual(nums, [10, 20, 30]);
	});
});
