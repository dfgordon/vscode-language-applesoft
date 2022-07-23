import * as config from '../../settings';
import * as lxbase from '../../langExtBase';
import * as com from '../../commands';
import * as assert from 'assert';

function testMinify(code: string, expected: string, tool: com.Minifier) {
	const actual = tool.minify(code);
	assert.deepStrictEqual(actual, expected+'\n');
}

describe('Minify Variables', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tool = new com.Minifier(TSInitResult,config.defaultSettings);
	});
	it('lower case long variable', function() {
		const testCode = '10 HOME\n20 PRINT hello';
		const expected = "10HOME\n20PRINThe";
		testMinify(testCode, expected, this.tool);
	});
	it('upper case long variable', function() {
		const testCode = '10 HOME\n20 PRINT HELLO';
		const expected = "10HOME\n20PRINTHE";
		testMinify(testCode, expected, this.tool);
	});
	it('lower case long array name', function() {
		const testCode = '10 print aero(xa1b2,ya2b1)';
		const expected = "10printae(xa,ya)";
		testMinify(testCode, expected, this.tool);
	});
	it('upper case long array name', function() {
		const testCode = '10 PRINT AERO(XA1B2,YA2B1)';
		const expected = "10PRINTAE(XA,YA)";
		testMinify(testCode, expected, this.tool);
	});
});

describe('Minify Functions', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tool = new com.Minifier(TSInitResult,config.defaultSettings);
	});
	it('lower case long function', function() {
		const testCode = '10 DEF FN abcd(x12) = x12^2\n20 PRINT FN abcd(x12)';
		const expected = '10DEFFNab(x1)=x1^2\n20PRINTFNab(x1)';
		testMinify(testCode, expected, this.tool);
	});
	it('upper case long function', function() {
		const testCode = '10 DEF FN ABCD(X12) = X12^2\n20 PRINT FN ABCD(X12)';
		const expected = '10DEFFNAB(X1)=X1^2\n20PRINTFNAB(X1)';
		testMinify(testCode, expected, this.tool);
	});
});

describe('Minify Separators', async function () {
	//vscode.window.showInformationMessage('Start output statements');
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tool = new com.Minifier(TSInitResult,config.defaultSettings);
	});
	it('unnecessary unquote', function() {
		const testCode = '10 HOME\n20 PRINT "HELLO"';
		const expected = '10HOME\n20PRINT"HELLO';
		testMinify(testCode, expected, this.tool);
	});
	it('print with nulls', function() {
		const testCode = '10 print a,b, ,c;d$;;;e$';
		const expected = "10printa,b,,c;d$;;;e$";
		testMinify(testCode, expected, this.tool);
	});
	it('trailing colon', function() {
		const testCode = '10 goto 10:';
		const expected = "10goto10";
		testMinify(testCode, expected, this.tool);
	});
	it('extra colons', function() {
		const testCode = '10 goto 10::goto 20:::goto 30::::';
		const expected = "10goto10:goto20:goto30";
		testMinify(testCode, expected, this.tool);
	});
	it('trailing colon after unquote', function() {
		const testCode = '10 print "1": print "2":';
		const expected = '10print"1":print"2';
		testMinify(testCode, expected, this.tool);
	});
});
