import * as vscode from 'vscode';
import * as lxbase from '../../langExtBase';
import * as com from '../../commands';
import * as assert from 'assert';

// Tokenization is tested against Virtual ][
// This assembly program generates the hex dump, which is then copied
// and pasted directly into the test.
//          ORG   300
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

describe('Output Statements', async function() {
	//vscode.window.showInformationMessage('Start output statements');
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tokTool = new com.TokenizationTool(TSInitResult);
	});
	it('single line', function() {
		const testCode = '10 HOME\n';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "07080A0097000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('multi line', function() {
		const testCode = '10 HOME\n20 PRINT "HELLO"';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "07080A00970014081400BA2248454C4C4F22000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('lower case variable', function() {
		const testCode = '10 HOME\n20 PRINT hello';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "07080A00970012081400BA48454C4C4F000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('print with nulls', function() {
		const testCode = '10 print a,b, ,c;d$;;;e$';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "15080A00BA412C422C2C433B44243B3B3B4524000000";
		assert.deepStrictEqual(actual,expected);
	});
});

describe('Data Statements', async function() {
	// ** in these tests spaces are important **
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tokTool = new com.TokenizationTool(TSInitResult);
	});
	it('simple', function() {
		const testCode = '10 DATA aliteral, "a string", 1\n';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "1F080A008320616C69746572616C2C20226120737472696E67222C2031000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('trailing statement', function() {
		const testCode = '10 DATA aliteral, "a string", 1  : PRINT A$ \n';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "25080A008320616C69746572616C2C20226120737472696E67222C203120203ABA4124000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('float items', function() {
		const testCode = '10 data 1.5 e 4 , 100000: print a$\n'; // lower case e is kept, but A2ROM does the same
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "1C080A008320312E3520652034202C203130303030303ABA4124000000";
		assert.deepStrictEqual(actual,expected);
	});
});

describe('Expressions', async function() {
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tokTool = new com.TokenizationTool(TSInitResult);
	});
	it('simple', function() {
		const testCode = '10 x = 1 + 1\n';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "0B080A0058D031C831000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('nested', function() {
		const testCode = '10 x = 1e6*(1 + (x1 + x2)*5)\n';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "19080A0058D0314536CA2831C8285831C8583229CA3529000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('with functions', function() {
		const testCode = '10 x = 1e6*(fn cub(x0) + (atn(x1) + cos(x2))*5)\n';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "26080A0058D0314536CA28C243554228583029C828E128583129C8DE2858322929CA3529000000";
		assert.deepStrictEqual(actual,expected);
	});
});

describe('Graphics', async function() {
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tokTool = new com.TokenizationTool(TSInitResult);
	});
	it('low res', function() {
		const testCode = '10 gr: color=4\n20 x=5:y=5\n30 plot x,y\n40 hlin x+1,x+10 at y\n50 vlin y+1,y+10 at x';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "0A080A00883AA034001608140058D0353A59D035001F081E008D582C59002F0828008E58C8312C58C83130C559003F0832008F59C8312C59C83130C558000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('high res', function() {
		const testCode = '10 hgr: hcolor=2\n20 x=5:y=5\n30 plot x,y\n40 hplot to x+5,y+5';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "0A080A00913A9232001608140058D0353A59D035001F081E008D582C59002D08280093C158C8352C59C835000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('shapes 1', function() {
		const testCode = '10 shload\n20 rot=0:scale=1:draw 5';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "07080A009A001408140098303A99313A9435000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('shapes 2', function() {
		const testCode = '10 xdraw 1 at 5,y(3)';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "0F080A009531C5352C59283329000000";
		assert.deepStrictEqual(actual,expected);
	});
});

describe('Control', async function() {
	this.beforeEach(async function() {
		const TSInitResult = await lxbase.TreeSitterInit();
		this.tokTool = new com.TokenizationTool(TSInitResult);
	});
	it('goto, gosub, end, return', function() {
		const testCode = '10 gosub 1000: goto 100\n100 end\n1000 return';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "10080A00B0313030303AAB313030001608640080001C08E803B1000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('on x goto/gosub', function() {
		const testCode = '10 on x goto 10,20,30\n100 on x gosub 110,120,130';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "11080A00B458AB31302C32302C33300024086400B458B03131302C3132302C313330000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('loop', function() {
		const testCode = '10 for i = 1 to last: print i: next i';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "15080A008149D031C14C4153543ABA493A8249000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('onerr, resume', function() {
		const testCode = '10 onerr goto 1000\n1000 resume';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "0C080A00A5AB31303030001208E803A6000000";
		assert.deepStrictEqual(actual,expected);
	});
	it('if then', function() {
		let testCode = '10 if x > y then 1000\n';
		testCode += '20 if x < y then 1010\n';
		testCode += '30 if x <> y then 1020\n';
		testCode += '40 if x = y then 1030\n';
		const tree = this.tokTool.parse(testCode);
		const tokStr = this.tokTool.tokenize(tree,2049);
		const actual = this.tokTool.hex_from_raw_str(tokStr);
		const expected = "0F080A00AD58CF59C431303030001D081400AD58D159C431303130002C081E00AD58D1CF59C431303230003A082800AD58D059C431303330000000";
		assert.deepStrictEqual(actual,expected);
	});
});
