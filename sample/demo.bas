10 GOSUB 100: GOSUB 200: GOSUB 300: REM finds nonexistant branch
20 END

100 P RI  NT "HELLO WORLD": REM ignores spaces
110 REM test REM: PRINT "I am not a statement"
120 FOR I = LOFT OR LEFT TO 15: REM finds error
130 PRINT TAB(2);I: NEXT: RETURN: REM left parenthesis part of token

200 DIM DANGER(3),DARKNESS(3): REM finds variable collisions
210 DEF FN CUB(X) = X^3
220 DAMAGE = DANGER(1) + DARKNESS(2)
230 DANGER = FN CUB(ATN(SIN(DAMAGE) + COS(DAMAGE))): RETURN

301 POKE 6,256: HCOLOR = 8: RETURN: REM finds bad values

1000 DATA HI "HO", "HI HO", HI HO, 1.37, 32768, 3.14159

200000 REM finds illegal line number
