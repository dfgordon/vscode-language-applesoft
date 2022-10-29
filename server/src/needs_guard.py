'''Enumerate all bad sequences of short variable names and operator-like tokens.
This produces a JSON file used by the minify command so it knows when to include
guarding parenthesis, e.g., `FOR X = (GE) TO 10`.'''

import json

with open("token_list.json") as f:
    tok_list = json.load(f)

alphas = "abcdefghijklmnopqrstuvwxyz"
ops = ["to","then","at","step","and","or"]

ans = {}

# Test every possible single character variable.
# Minify does not actually use this, but it only adds minimally to the list.
# This will want to guard `A TO` which is actually not necessary.
for var_name in alphas:
    for tok_test in ops:
        test = var_name + tok_test
        for tok_search in tok_list:
            lex = tok_search["lexeme"]
            typ = "tok_" + tok_test
            if test.find(lex)==0:
                if var_name in ans:
                    ans[var_name] += [typ]
                else:
                    ans[var_name] = [typ]

# Test every possible two-character alpha variable.
# We need not worry about guarding direct matches since that would be an unconditional error.
for c1 in alphas:
    for c2 in alphas:
        var_name = c1+c2
        for tok_test in ops:
            test = var_name + tok_test
            for tok_search in tok_list:
                lex = tok_search["lexeme"]
                typ = "tok_" + tok_test
                if lex!=var_name and (test.find(lex)==0 or test.find(lex)==1):
                    if var_name in ans:
                        ans[var_name] += [typ]
                    else:
                        ans[var_name] = [typ]

# write out the result.
# this is a dictionary with short variable names as keys, and a list of guard-inducing
# trailing token-types as values.
with open("short_var_guards.json","w") as f:
    json.dump(ans,f,indent=4)
