import * as config from '../../settings';
import * as lxbase from '../../langExtBase';
import * as com from '../../commands';
import * as assert from 'assert';

// Tokenization is tested against Virtual ][
// This assembly program generates the hex dump, which is then copied
// and pasted directly into the test.
//          ORG   $300
// ZPTR     EQU   $06
// SPTR     EQU   $08
// PRGST    EQU   $67
// PRGEND   EQU   $AF
// PRBYTE   EQU   $FDDA
//          LDA   PRGST
//          STA   ZPTR
//          LDA   PRGST+1
//          STA   ZPTR+1
//          SEC
//          LDA   PRGEND
//          SBC   #$01
//          STA   SPTR
//          LDA   PRGEND+1
//          SBC   #$00
//          STA   SPTR+1
// :LOOP    LDY   #$00
//          LDA   (ZPTR),Y
//          JSR   PRBYTE
//          CLC
//          LDA   #$01
//          ADC   ZPTR
//          STA   ZPTR
//          LDA   #$00
//          ADC   ZPTR+1
//          STA   ZPTR+1
//          LDA   SPTR
//          CMP   ZPTR
//          BNE   :LOOP
//          LDA   SPTR+1
//          CMP   ZPTR+1
//          BNE   :LOOP
//          RTS

async function testTokenizer(code: string, expected: string) {
	const TSInitResult = await lxbase.TreeSitterInit();
	const tool = new com.Tokenizer(TSInitResult, config.defaultSettings);
	const tokStr = tool.tokenize(code, 2049);
	const actual = tool.hex_from_raw_str(tokStr);
	assert.deepStrictEqual(actual, expected);
}

describe('Input Statements', async function () {
	it('quote parity', async function () {
		const testCode = "10 PRINT CHR$(4);\"PREFIX\": INPUT PR$\n";
		const expected = "19080A00BAE72834293B22505245464958223A84505224000000";
		await testTokenizer(testCode, expected);
	});
	it('input null prompt', async function () {
		const testCode = "10 input \"\"; a$\n";
		const expected = "0C080A008422223B4124000000";
		await testTokenizer(testCode, expected);
	});
	it('get multi', async function () {
		const testCode = "10 GET A$,B$,C$\n";
		const expected = "0F080A00BE41242C42242C4324000000";
		await testTokenizer(testCode, expected);
	});
});

describe('Output Statements', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	it('single line', async function() {
		const testCode = '10 HOME\n';
		const expected = "07080A0097000000";
		await testTokenizer(testCode, expected);
	});
	it('multi line', async function() {
		const testCode = '10 HOME\n20 PRINT "HELLO"';
		const expected = "07080A00970014081400BA2248454C4C4F22000000";
		await testTokenizer(testCode, expected);
	});
	it('lower case variable', async function() {
		const testCode = '10 HOME\n20 PRINT hello';
		const expected = "07080A00970012081400BA48454C4C4F000000";
		await testTokenizer(testCode, expected);
	});
	it('print with nulls', async function() {
		const testCode = '10 print a,b, ,c;d$;;;e$';
		const expected = "15080A00BA412C422C2C433B44243B3B3B4524000000";
		await testTokenizer(testCode, expected);
	});
});

describe('Data Statements', async function() {
	// ** in these tests spaces are important **
	it('simple', async function() {
		const testCode = '10 DATA aliteral, "a string", 1\n';
		const expected = "1F080A008320616C69746572616C2C20226120737472696E67222C2031000000";
		await testTokenizer(testCode, expected);
	});
	it('trailing statement', async function() {
		const testCode = '10 DATA aliteral, "a string", 1  : PRINT A$ \r\n';
		const expected = "25080A008320616C69746572616C2C20226120737472696E67222C203120203ABA4124000000";
		await testTokenizer(testCode, expected);
	});
	it('float items', async function() {
		const testCode = '10 data 1.5 e 4 , 100000: print a$\n'; // lower case e is kept, but A2ROM does the same
		const expected = "1C080A008320312E3520652034202C203130303030303ABA4124000000";
		await testTokenizer(testCode, expected);
	});
	it('negative numbers', async function () {
		const testCode = '10 data - 1.0,-1.1,- 5\n';
		const expected = "16080A0083202D20312E302C2D312E312C2D2035000000";
		await testTokenizer(testCode, expected);
	});
});

describe('Expressions', async function() {
	it('simple', async function() {
		const testCode = '10 x = 1 + 1\n';
		const expected = "0B080A0058D031C831000000";
		await testTokenizer(testCode, expected);
	});
	it('nested', async function() {
		const testCode = '10 x = 1e6*(1 + (x1 + x2)*5)\r\n';
		const expected = "19080A0058D0314536CA2831C8285831C8583229CA3529000000";
		await testTokenizer(testCode, expected);
	});
	it('with functions', async function() {
		const testCode = '10 x = 1e6*(fn cub(x0) + (atn(x1) + cos(x2))*5)\n';
		const expected = "26080A0058D0314536CA28C243554228583029C828E128583129C8DE2858322929CA3529000000";
		await testTokenizer(testCode, expected);
	});
	it('negative numbers', async function() {
		const testCode = '10 x = -1.0: y = - 2.35\n';
		const expected = "14080A0058D0C9312E303A59D0C9322E3335000000";
		await testTokenizer(testCode, expected);
	});
});

describe('Graphics', async function() {
	it('low res', async function() {
		const testCode = '10 gr: color=4\n20 x=5:y=5\n30 plot x,y\r\n40 hlin x+1,x+10 at y\n50 vlin y+1,y+10 at x';
		const expected = "0A080A00883AA034001608140058D0353A59D035001F081E008D582C59002F0828008E58C8312C58C83130C559003F0832008F59C8312C59C83130C558000000";
		await testTokenizer(testCode, expected);
	});
	it('high res', async function() {
		const testCode = '10 hgr: hcolor=2\n20 x=5:y=5\n30 plot x,y\n40 hplot to x+5,y+5';
		const expected = "0A080A00913A9232001608140058D0353A59D035001F081E008D582C59002D08280093C158C8352C59C835000000";
		await testTokenizer(testCode, expected);
	});
	it('shapes 1', async function() {
		const testCode = '10 shload\n20 rot=0:scale=1:draw 5';
		const expected = "07080A009A001408140098303A99313A9435000000";
		await testTokenizer(testCode, expected);
	});
	it('shapes 2', async function() {
		const testCode = '10 xdraw 1 at 5,y(3)';
		const expected = "0F080A009531C5352C59283329000000";
		await testTokenizer(testCode, expected);
	});
});

describe('Control', async function() {
	it('goto, gosub, end, return', async function() {
		const testCode = '10 gosub 1000: goto 100\n100 end\n1000 return';
		const expected = "10080A00B0313030303AAB313030001608640080001C08E803B1000000";
		await testTokenizer(testCode, expected);
	});
	it('on x goto/gosub', async function() {
		const testCode = '10 on x goto 10,20,30\n100 on x gosub 110,120,130';
		const expected = "11080A00B458AB31302C32302C33300024086400B458B03131302C3132302C313330000000";
		await testTokenizer(testCode, expected);
	});
	it('loop', async function() {
		const testCode = '10 for i = 1 to last: print i: next i';
		const expected = "15080A008149D031C14C4153543ABA493A8249000000";
		await testTokenizer(testCode, expected);
	});
	it('onerr, resume', async function() {
		const testCode = '10 onerr goto 1000\n1000 resume';
		const expected = "0C080A00A5AB31303030001208E803A6000000";
		await testTokenizer(testCode, expected);
	});
	it('if then', async function() {
		let testCode = ' 1 0  if x > y then 1000\n';
		testCode += '20 if x < y then 1010\n';
		testCode += '30 if x <> y then 1020\n';
		testCode += '40 if x = y then 1030\n';
		const expected = "0F080A00AD58CF59C431303030001D081400AD58D159C431303130002C081E00AD58D1CF59C431303230003A082800AD58D059C431303330000000";
		await testTokenizer(testCode, expected);
	});
});

describe('Escapes', async function () {
	it('string escapes', async function () {
		const testCode = "10 print \"\\x0d1\\x0d2\\x0a\\x0a\"";
		const expected = "0F080A00BA220D310D320A0A22000000";
		await testTokenizer(testCode, expected);
	});
	it('terminal string escapes', async function () {
		const testCode = "10 print \"\\x0d1\\x0d2\\x0a\\x0a:rem";
		const expected = "12080A00BA220D310D320A0A3A72656D000000";
		await testTokenizer(testCode, expected);
	});
	it('data escapes', async function () {
		const testCode = "10 data \":\",\\x5Cxff : rem \\\\\\\\";
		const expected = "18080A008320223A222C5C786666203AB2205C5C5C5C000000";
		await testTokenizer(testCode, expected);
	});
	it('data literal escapes', async function () {
		const testCode = "10 data literal\\\\x0awith stuff\n";
		const expected = "1B080A0083206C69746572616C5C0A77697468207374756666000000";
		await testTokenizer(testCode, expected);
	});
	it('rem escapes', async function () {
		const testCode = "10 rem \\x0a\\x0aAAA\\x0a\\x0a";
		const expected = "0F080A00B2200A0A4141410A0A000000";
		await testTokenizer(testCode, expected);
	});
	it('DOS escapes', async function () {
		const testCode = "0 PR# 0\n1 PRINT:PRINT \"\\x04BLOAD DATA1,A$4000\":END\n";
		const expected = "080800008A300027080100BA3ABA2204424C4F41442044415441312C412434303030223A80000000";
		await testTokenizer(testCode, expected);
	});
});

describe('Ampersand', async function () {
	it('null_string_only', async function () {
		const testCode = "10 & \"";
		const expected = "08080A00AF22000000";
		await testTokenizer(testCode, expected);
	});
	it('string_only', async function () {
		const testCode = "10 & \"print something\"";
		const expected = "18080A00AF227072696E7420736F6D657468696E6722000000";
		await testTokenizer(testCode, expected);
	});
	it('anon_func_form', async function () {
		const testCode = "10 & (\"sarg\",x+y,a$)";
		const expected = "16080A00AF282273617267222C58C8592C412429000000";
		await testTokenizer(testCode, expected);
	});
	// syntax is not supported but test will pass
	it('func_form1', async function () {
		const testCode = "10 & \"print\"(x+y,a$)";
		const expected = "16080A00AF227072696E74222858C8592C412429000000";
		await testTokenizer(testCode, expected);
	});
	it('overloaded_tok_func', async function () {
		const testCode = "10 & print(x+y,a$)";
		const expected = "10080A00AFBA2858C8592C412429000000";
		await testTokenizer(testCode, expected);
	});
	it('func_form3', async function () {
		const testCode = "10 & MyFunc(x+y,a$)";
		const expected = "15080A00AF4D5946554E432858C8592C412429000000";
		await testTokenizer(testCode, expected);
	});
	it('statement_form1', async function () {
		const testCode = "10 & PR USNG > \"0.00\";A$";
		const expected = "17080A00AF505255534E47CF22302E3030223B4124000000";
		await testTokenizer(testCode, expected);
	});
	it('statement_form2', async function () {
		const testCode = "10 & cal ; cos(x)*sin(y)";
		const expected = "14080A00AF43414C3BDE285829CADF285929000000";
		await testTokenizer(testCode, expected);
	});
	it('overloaded_tok_statement', async function () {
		const testCode = "10 & DRAW AT X0,Y0";
		const expected = "0E080A00AF94C558302C5930000000";
		await testTokenizer(testCode, expected);
	});
});
