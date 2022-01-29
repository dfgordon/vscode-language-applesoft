1 DEF FN CUB(X) = X^3: DIM TELLURIUM(5)
10 GOSUB 100: GOSUB 200: GOSUB 300: END: REM bad branch

100 P RI  NT "HELLO WORLD": REM ignores spaces
110 REM test REM: PRINT "I am not a statement"
120 FOR I = LOFT OR LEFT TO 15: REM hidden token
130 PRINT TAB(2);I: NEXT: RETURN: REM left parenthesis part of token

200 TEST = TELLURIUM(1) + TENSILE(2): REM variable name collisions
210 TELL = FN CUB(ATN(SIN(TEST) + COS(TEST))): RETURN

301 POKE -16370,256: HCOLOR = 8: REM range errors
310000 RETURN: REM illegal line number
