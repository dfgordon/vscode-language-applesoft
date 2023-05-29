import * as config from '../../settings';
import * as lxbase from '../../langExtBase';
import * as com from '../../commands';
import * as assert from 'assert';

async function testDetokenizer(hex_tokens: string, expected: string) {
	const TSInitResult = await lxbase.TreeSitterInit();
	const tool = new com.Tokenizer(TSInitResult,config.defaultSettings);
	const matches = hex_tokens.match(/[0-9a-fA-F][0-9a-fA-F]/g);
	if (!matches) {
		assert.fail("invalid hex tokens");
	}
	const tokens = matches.map(t => parseInt(t, 16));
	const img = new Array<number>(65536);
	img[103] = 0;
	img[104] = 1;
	for (let i = 0; i < tokens.length; i++)
		img[256 + i] = tokens[i];
	const actual = tool.detokenize(img);
	assert.deepStrictEqual(actual, expected);
}

describe('Input Statements', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	it('quote parity', async function() {
		const expected = "10  PRINT  CHR$ (4);\"PREFIX\": INPUT PR$\n";
		const tokens = "19080A00BAE72834293B22505245464958223A84505224000000";
		await testDetokenizer(tokens, expected);
	});
	it('input null prompt', async function() {
		const expected = "10  INPUT \"\";A$\n";
		const tokens = "0C080A008422223B4124000000";
		await testDetokenizer(tokens, expected);
	});
	it('get multi', async function() {
		const expected = "10  GET A$,B$,C$\n";
		const tokens = "0F080A00BE41242C42242C4324000000";
		await testDetokenizer(tokens, expected);
	});
});

describe('Output Statements', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	it('single line', async function() {
		const expected = '10  HOME \n';
		const tokens = "07080A0097000000";
		await testDetokenizer(tokens, expected);
	});
	it('multi line', async function() {
		const expected = '10  HOME \n20  PRINT "HELLO"\n';
		const tokens = "07080A00970014081400BA2248454C4C4F22000000";
		await testDetokenizer(tokens, expected);
	});
	it('lower case variable', async function() {
		const expected = '10  HOME \n20  PRINT HELLO\n';
		const tokens = "07080A00970012081400BA48454C4C4F000000";
		await testDetokenizer(tokens, expected);
	});
	it('print with nulls', async function() {
		const expected = '10  PRINT A,B,,C;D$;;;E$\n';
		const tokens = "15080A00BA412C422C2C433B44243B3B3B4524000000";
		await testDetokenizer(tokens, expected);
	});
});

describe('Data Statements', async function() {
	// ** in these tests spaces are important **
	it('simple', async function() {
		const expected = '10  DATA  aliteral, "a string", 1\n';
		const tokens = "1F080A008320616C69746572616C2C20226120737472696E67222C2031000000";
		await testDetokenizer(tokens, expected);
	});
	it('trailing statement', async function() {
		const expected = '10  DATA  aliteral, "a string", 1  : PRINT A$\n';
		const tokens = "25080A008320616C69746572616C2C20226120737472696E67222C203120203ABA4124000000";
		await testDetokenizer(tokens, expected);
	});
	it('float items', async function() {
		const expected = '10  DATA  1.5 e 4 , 100000: PRINT A$\n'; // lower case e is kept, but A2ROM does the same
		const tokens = "1C080A008320312E3520652034202C203130303030303ABA4124000000";
		await testDetokenizer(tokens, expected);
	});
	it('negative numbers', async function () {
		const expected = '10  DATA  - 1.0,-1.1,- 5\n';
		const tokens = "16080A0083202D20312E302C2D312E312C2D2035000000";
		await testDetokenizer(tokens, expected);
	});
});

describe('Expressions', async function() {
	it('simple', async function() {
		const expected = '10 X = 1 + 1\n';
		const tokens = "0B080A0058D031C831000000";
		await testDetokenizer(tokens, expected);
	});
	it('nested', async function() {
		const expected = '10 X = 1E6 * (1 + (X1 + X2) * 5)\n';
		const tokens = "19080A0058D0314536CA2831C8285831C8583229CA3529000000";
		await testDetokenizer(tokens, expected);
	});
	it('with functions', async function() {
		const expected = '10 X = 1E6 * ( FN CUB(X0) + ( ATN (X1) +  COS (X2)) * 5)\n';
		const tokens = "26080A0058D0314536CA28C243554228583029C828E128583129C8DE2858322929CA3529000000";
		await testDetokenizer(tokens, expected);
	});
	it('negative numbers', async function() {
		const expected = '10 X =  - 1.0:Y =  - 2.35\n';
		const tokens = "14080A0058D0C9312E303A59D0C9322E3335000000";
		await testDetokenizer(tokens, expected);
	});
});

describe('Graphics', async function() {
	it('low res', async function() {
		const expected = '10  GR : COLOR= 4\n20 X = 5:Y = 5\n30  PLOT X,Y\n40  HLIN X + 1,X + 10 AT Y\n50  VLIN Y + 1,Y + 10 AT X\n';
		const tokens = "0A080A00883AA034001608140058D0353A59D035001F081E008D582C59002F0828008E58C8312C58C83130C559003F0832008F59C8312C59C83130C558000000";
		await testDetokenizer(tokens, expected);
	});
	it('high res', async function() {
		const expected = '10  HGR : HCOLOR= 2\n20 X = 5:Y = 5\n30  PLOT X,Y\n40  HPLOT  TO X + 5,Y + 5\n';
		const tokens = "0A080A00913A9232001608140058D0353A59D035001F081E008D582C59002D08280093C158C8352C59C835000000";
		await testDetokenizer(tokens, expected);
	});
	it('shapes 1', async function() {
		const expected = '10  SHLOAD \n20  ROT= 0: SCALE= 1: DRAW 5\n';
		const tokens = "07080A009A001408140098303A99313A9435000000";
		await testDetokenizer(tokens, expected);
	});
	it('shapes 2', async function() {
		const expected = '10  XDRAW 1 AT 5,Y(3)\n';
		const tokens = "0F080A009531C5352C59283329000000";
		await testDetokenizer(tokens, expected);
	});
});

describe('Control', async function() {
	it('goto, gosub, end, return', async function() {
		const expected = '10  GOSUB 1000: GOTO 100\n100  END \n1000  RETURN \n';
		const tokens = "10080A00B0313030303AAB313030001608640080001C08E803B1000000";
		await testDetokenizer(tokens, expected);
	});
	it('on x goto/gosub', async function() {
		const expected = '10  ON X GOTO 10,20,30\n100  ON X GOSUB 110,120,130\n';
		const tokens = "11080A00B458AB31302C32302C33300024086400B458B03131302C3132302C313330000000";
		await testDetokenizer(tokens, expected);
	});
	it('loop', async function() {
		const expected = '10  FOR I = 1 TO LAST: PRINT I: NEXT I\n';
		const tokens = "15080A008149D031C14C4153543ABA493A8249000000";
		await testDetokenizer(tokens, expected);
	});
	it('onerr, resume', async function() {
		const expected = '10  ONERR  GOTO 1000\n1000  RESUME \n';
		const tokens = "0C080A00A5AB31303030001208E803A6000000";
		await testDetokenizer(tokens, expected);
	});
	it('if then', async function() {
		let expected = '10  IF X > Y THEN 1000\n';
		expected += '20  IF X < Y THEN 1010\n';
		expected += '30  IF X <  > Y THEN 1020\n';
		expected += '40  IF X = Y THEN 1030\n';
		const tokens = "0F080A00AD58CF59C431303030001D081400AD58D159C431303130002C081E00AD58D1CF59C431303230003A082800AD58D059C431303330000000";
		await testDetokenizer(tokens, expected);
	});
});

describe('Escapes', async function () {
	it('string escapes', async function () {
		const expected = "10  PRINT \"\\x0d1\\x0d2\\x0a\\x0a\"\n";
		const tokens = "0F080A00BA220D310D320A0A22000000";
		await testDetokenizer(tokens, expected);
	});
	it('terminal string escapes', async function () {
		const expected = "10  PRINT \"\\x0d1\\x0d2\\x0a\\x0a:rem\n";
		const tokens = "12080A00BA220D310D320A0A3A72656D000000";
		await testDetokenizer(tokens, expected);
	});
	it('data escapes', async function () {
		const expected = "10  DATA  \":\",\\x5cxff : REM  \\\\\\\\\n";
		const tokens = "18080A008320223A222C5C786666203AB2205C5C5C5C000000";
		await testDetokenizer(tokens, expected);
	});
	it('data literal escapes', async function () {
		const expected = "10  DATA  literal\\\\x0awith stuff\n";
		const tokens = "1B080A0083206C69746572616C5C0A77697468207374756666000000";
		await testDetokenizer(tokens, expected);
	});
	it('rem escapes', async function () {
		const expected = "10  REM \\x0a\\x0aAAA\\x0a\\x0a\n";
		const tokens = "0E080A00B20A0A4141410A0A000000";
		await testDetokenizer(tokens, expected);
	});
	it('DOS non-escapes', async function () {
		const expected = "0  PR# 0\n1  PRINT : PRINT \"\x04BLOAD DATA1,A$4000\": END \n";
		const tokens = "080800008A300027080100BA3ABA2204424C4F41442044415441312C412434303030223A80000000";
		await testDetokenizer(tokens, expected);
	});
});

describe('Ampersand', async function () {
	it('null_string_only', async function () {
		const expected = "10  & \"\n";
		const tokens = "08080A00AF22000000";
		await testDetokenizer(tokens, expected);
	});
	it('string_only', async function () {
		const expected = "10  & \"print something\"\n";
		const tokens = "18080A00AF227072696E7420736F6D657468696E6722000000";
		await testDetokenizer(tokens, expected);
	});
	it('anon_func_form', async function () {
		const expected = "10  & (\"sarg\",X + Y,A$)\n";
		const tokens = "16080A00AF282273617267222C58C8592C412429000000";
		await testDetokenizer(tokens, expected);
	});
	// syntax is not supported but test will pass
	it('func_form1', async function () {
		const expected = "10  & \"print\"(X + Y,A$)\n";
		const tokens = "16080A00AF227072696E74222858C8592C412429000000";
		await testDetokenizer(tokens, expected);
	});
	it('overloaded_tok_func', async function () {
		const expected = "10  &  PRINT (X + Y,A$)\n";
		const tokens = "10080A00AFBA2858C8592C412429000000";
		await testDetokenizer(tokens, expected);
	});
	it('func_form3', async function () {
		const expected = "10  & MYFUNC(X + Y,A$)\n";
		const tokens = "15080A00AF4D5946554E432858C8592C412429000000";
		await testDetokenizer(tokens, expected);
	});
	it('statement_form1', async function () {
		const expected = "10  & PRUSNG > \"0.00\";A$\n";
		const tokens = "17080A00AF505255534E47CF22302E3030223B4124000000";
		await testDetokenizer(tokens, expected);
	});
	it('statement_form2', async function () {
		const expected = "10  & CAL; COS (X) *  SIN (Y)\n";
		const tokens = "14080A00AF43414C3BDE285829CADF285929000000";
		await testDetokenizer(tokens, expected);
	});
	it('overloaded_tok_statement', async function () {
		const expected = "10  &  DRAW  AT X0,Y0\n";
		const tokens = "0E080A00AF94C558302C5930000000";
		await testDetokenizer(tokens, expected);
	});
});
