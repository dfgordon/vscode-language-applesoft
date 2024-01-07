import * as config from '../../settings';
import * as lxbase from '../../langExtBase';
import * as com from '../../commands';
import * as assert from 'assert';

async function testMinify(code: string, expected: string) {
	const TSInitResult = await lxbase.TreeSitterInit();
	const tool = new com.Minifier(TSInitResult, console, config.defaultSettings);
	const actual = tool.minify(code);
	assert.deepStrictEqual(actual, expected+'\n');
}

describe('Minify Variables', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	it('lower case long variable', async function() {
		const testCode = '10 HOME\n20 PRINT hello';
		const expected = "10HOME\n20PRINThe";
		await testMinify(testCode, expected);
	});
	it('upper case long variable', async function() {
		const testCode = '10 HOME\r\n20 PRINT HELLO';
		const expected = "10HOME\n20PRINTHE";
		await testMinify(testCode, expected);
	});
	it('lower case long string', async function() {
		const testCode = '10 HOME\n20 PRINT hello$';
		const expected = "10HOME\n20PRINThe$";
		await testMinify(testCode, expected);
	});
	it('upper case long string', async function() {
		const testCode = '10 HOME\n20 PRINT HELLO$';
		const expected = "10HOME\n20PRINTHE$";
		await testMinify(testCode, expected);
	});
	it('lower case long int', async function() {
		const testCode = '10 HOME\n20 PRINT hello%';
		const expected = "10HOME\n20PRINThe%";
		await testMinify(testCode, expected);
	});
	it('upper case long int', async function() {
		const testCode = '10 HOME\r\n20 PRINT HELLO%';
		const expected = "10HOME\n20PRINTHE%";
		await testMinify(testCode, expected);
	});
	it('lower case long array name', async function() {
		const testCode = '10 print aero(xa1b2,ya2b1)';
		const expected = "10printae(xa,ya)";
		await testMinify(testCode, expected);
	});
	it('upper case long array name', async function() {
		const testCode = '10 PRINT AERO(XA1B2,YA2B1)';
		const expected = "10PRINTAE(XA,YA)";
		await testMinify(testCode, expected);
	});
	it('lower case long string array', async function() {
		const testCode = '10 print aero$(xa1b2,ya2b1)';
		const expected = "10printae$(xa,ya)";
		await testMinify(testCode, expected);
	});
	it('upper case long string array', async function() {
		const testCode = '10 PRINT AERO$(XA1B2,YA2B1)';
		const expected = "10PRINTAE$(XA,YA)";
		await testMinify(testCode, expected);
	});
	it('lower case long int array', async function() {
		const testCode = '10 print aero%(xa1b2,ya2b1)';
		const expected = "10printae%(xa,ya)";
		await testMinify(testCode, expected);
	});
	it('upper case long int array', async function() {
		const testCode = '10 PRINT AERO%(XA1B2,YA2B1)';
		const expected = "10PRINTAE%(XA,YA)";
		await testMinify(testCode, expected);
	});
	it('short variables only', async function() {
		const testCode = '10 PRINT A%(X,Y) A$(X%,Y%)';
		const expected = "10PRINTA%(X,Y)A$(X%,Y%)";
		await testMinify(testCode, expected);
	});
	it('amp_func_vars', async function() {
		const testCode = "10 & MYFUNC (HELLO+Y,AERO%(XA1B2,YA2B1),aero$(x1ab2,y1ab1))";
		const expected = "10& MYFUNC (HELLO+Y,AERO%(XA1B2,YA2B1),aero$(x1ab2,y1ab1))";
		await testMinify(testCode, expected);
	});
	it('amp_expr_list', async function() {
		const testCode = "10 & (\"cmd\",HELLO+Y,AERO%(XA1B2,YA2B1),aero$(x1ab2,y1ab1))";
		const expected = "10& (\"cmd\",HELLO+Y,AERO%(XA1B2,YA2B1),aero$(x1ab2,y1ab1))";
		await testMinify(testCode, expected);
	});
	it('amp_overloaded_toks', async function() {
		const testCode = "10 & draw \"subcmd\" at HELLO+Y,AERO%(XA1B2,YA2B1) and aero%(x1ab2,y1ab1)";
		const expected = "10& draw \"subcmd\" at HELLO+Y,AERO%(XA1B2,YA2B1) and aero%(x1ab2,y1ab1)";
		await testMinify(testCode, expected);
	});
});

describe('Minify Variables with Guards', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	it('TO and STEP guards', async function() {
		const testCode = '10 for x = ca12345 to abracadabra step 5';
		const expected = "10forx=(ca)to(ab)step5";
		await testMinify(testCode, expected);
	});
	it('atn_guard', async function() {
		const testCode = "10 hlin x,xrght at n";
		const expected = "10hlinx,xrat n";
		await testMinify(testCode, expected);
	});
	it('ato_guard', async function() {
		const testCode = "10 draw br at o1,o2";
		const expected = "10drawbrat o1,o2";
		await testMinify(testCode, expected);
	});
	it('logic guards', async function() {
		const testCode = '10 if hf123 or it123 and nobody then 100';
		const expected = "10if(hf)or(it)and(no)then100";
		await testMinify(testCode, expected);
	});
	it('logic non-guards', async function() {
		const testCode = '10 if hf123% or it123% and nobody% then 100';
		const expected = "10ifhf%orit%andno%then100";
		await testMinify(testCode, expected);
	});
	it('negated logic guards', async function() {
		const testCode = '10 if not hf123 or not it123 and not nobody then 100';
		const expected = "10ifnot(hf)ornot(it)andnot(no)then100";
		await testMinify(testCode, expected);
	});
	it('not worth shortening', async function() {
		const testCode = '10 if not hf12 or not it12 and not nobo then 100';
		const expected = "10ifnothf12ornotit12andnotnobothen100";
		await testMinify(testCode, expected);
	});
	it('spaces thrown in', async function() {
		const testCode = '10 for x = ca1  23 45 to abrac adabra step 5';
		const expected = "10forx=(ca)to(ab)step5";
		await testMinify(testCode, expected);
	});
});

describe('Minify Functions', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	it('lower case long function', async function() {
		const testCode = '10 DEF FN abcd(x12) = x12^2\n20 PRINT FN abcd(x12)';
		const expected = '10DEFFNab(x1)=x1^2\n20PRINTFNab(x1)';
		await testMinify(testCode, expected);
	});
	it('upper case long function', async function() {
		const testCode = '10 DEF FN ABCD(X12) = X12^2\r\n20 PRINT FN ABCD(X12)';
		const expected = '10DEFFNAB(X1)=X1^2\n20PRINTFNAB(X1)';
		await testMinify(testCode, expected);
	});
});

describe('Minify Separators', async function () {
	//vscode.window.showInformationMessage('Start output statements');
	it('unnecessary unquote', async function() {
		const testCode = '10 HOME\n20 PRINT "HELLO"';
		const expected = '10HOME\n20PRINT"HELLO';
		await testMinify(testCode, expected);
	});
	it('unnecessary unquote sexpr', async function() {
		const testCode = '10 HOME\n20 A$ = A$ + B$ + "HELLO"';
		const expected = '10HOME\n20A$=A$+B$+"HELLO';
		await testMinify(testCode, expected);
	});
	it('print with nulls', async function() {
		const testCode = '10 print a,b, ,c;d$;;;e$';
		const expected = "10printa,b,,c;d$;;;e$";
		await testMinify(testCode, expected);
	});
	it('trailing colon', async function() {
		const testCode = '10 goto 10:';
		const expected = "10goto10";
		await testMinify(testCode, expected);
	});
	it('extra colons', async function() {
		const testCode = '10 goto 10::goto 20:::goto 30::::';
		const expected = "10goto10:goto20:goto30";
		await testMinify(testCode, expected);
	});
	it('trailing colon after unquote', async function() {
		const testCode = '10 print "1": print "2":';
		const expected = '10print"1":print"2';
		await testMinify(testCode, expected);
	});
});
