local utils = require("utils")

local testArweaveAddress = "test-this-is-valid-arweave-wallet-address-1"
local testEthAddress = "0xFCAd0B19bB29D4674531d6f115237E16AfCE377c"

describe("utils", function()
	describe("isValidUnformattedEthAddress", function()
		it("should return true on a valid unformatted ETH address", function()
			assert.is_true(utils.isValidUnformattedEthAddress(testEthAddress))
		end)

		it("should return false on a non-string value", function()
			assert.is_false(utils.isValidUnformattedEthAddress(3))
		end)

		it("should return false on an invalid unformatted ETH address", function()
			assert.is_false(utils.isValidUnformattedEthAddress("ZxFCAd0B19bB29D4674531d6f115237E16AfCE377C"))
		end)
	end)

	describe("formatAddress", function()
		it("should format ETH address to lowercase", function()
			assert.is.equal(testEthAddress, utils.formatAddress(testEthAddress))
			assert.is.equal(testEthAddress, utils.formatAddress(string.lower(testEthAddress)))
			assert.is.equal(testEthAddress, utils.formatAddress("0x" .. string.upper(string.sub(testEthAddress, 3))))
		end)
		it("should return non-ETH address as-is", function()
			assert.is.equal(testArweaveAddress, utils.formatAddress(testArweaveAddress))
		end)
	end)

	describe("toTrainCase", function()
		it("should convert a string to Train-Case", function()
			assert.are.same("Hello", utils.toTrainCase("hello"))
			assert.are.same("Hello", utils.toTrainCase("Hello"))
			assert.are.same("Hello-World", utils.toTrainCase("Hello World"))
			assert.are.same("Hello-World", utils.toTrainCase("hello world"))
			assert.are.same("Hello-World", utils.toTrainCase("hello-world"))
			assert.are.same("Hello-World", utils.toTrainCase("hello_world"))
			assert.are.same("Hello-World", utils.toTrainCase("helloWorld"))
			assert.are.same("Hello-World", utils.toTrainCase("HelloWorld"))
			assert.are.same("Hello-World", utils.toTrainCase("Hello-World"))
			assert.are.same("Hello-Worl-D", utils.toTrainCase("Hello-WorlD"))
			assert.are.same("HW-Hello-World", utils.toTrainCase("HW-helloWorld"))
		end)
	end)

	describe("createLookupTable", function()
		it("should create a lookup table from a list of strings", function()
			local input = { "apple", "banana", "cherry", "date" }
			local result = utils.createLookupTable(input)
			assert.are.same({
				apple = true,
				banana = true,
				cherry = true,
				date = true,
			}, result)
		end)

		it("should create a lookup table from a list of numbers", function()
			local input = { 1, 2, 3, 4 }
			local result = utils.createLookupTable(input)
			assert.are.same({
				[1] = true,
				[2] = true,
				[3] = true,
				[4] = true,
			}, result)
		end)

		it("should create a lookup table from a list of mixed types", function()
			local input = { "apple", 2, "cherry", 4 }
			local result = utils.createLookupTable(input)
			assert.are.same({
				apple = true,
				[2] = true,
				cherry = true,
				[4] = true,
			}, result)
		end)

		it("should create an empty lookup table from an empty list", function()
			local input = {}
			local result = utils.createLookupTable(input)
			assert.are.same({}, result)
		end)

		it("should create an empty lookup table from a nil list", function()
			local result = utils.createLookupTable(nil)
			assert.are.same({}, result)
		end)

		it("should use a provided value assignment function", function()
			local input = { "apple", "banana", "cherry", "date" }
			local result = utils.createLookupTable(input, function(_, value)
				return value .. "s"
			end)
			assert.are.same({
				apple = "apples",
				banana = "bananas",
				cherry = "cherrys",
				date = "dates",
			}, result)
		end)
	end)

	describe("deepCopy", function()
		it("should deep copy a table with nested tables containing mixed types", function()
			local input = {
				foo = "bar",
				baz = 2,
				qux = { 1, 2, 3 },
				quux = { a = "b", c = "d" },
				oof = true,
			}
			local result = utils.deepCopy(input)
			assert.are.same(input, result)
			assert.are_not.equal(input, result)
			assert.are_not.equal(input.qux, result.qux)
			assert.are_not.equal(input.quux, result.quux)
		end)

		it("should exclude nested fields specified in the exclusion list while preserving array indexing", function()
			local input = {
				foo = "bar",
				baz = 2,
				qux = { 1, 2, 3 },
				quux = { a = "b", c = "d" },
				oof = true,
			}
			local result = utils.deepCopy(input, { "foo", "qux.2", "quux.c" })
			assert.are.same({
				baz = 2,
				qux = { 1, 3 },
				quux = { a = "b" },
				oof = true,
			}, result)
			assert.are_not.equal(input, result)
		end)
	end)

	describe("isInteger", function()
		it("should return true for valid integers", function()
			assert.is_true(utils.isInteger(0))
			assert.is_true(utils.isInteger(-1))
			assert.is_true(utils.isInteger(123456789))
			assert.is_true(utils.isInteger("0"))
			assert.is_true(utils.isInteger("-1"))
			assert.is_true(utils.isInteger("123456789"))
		end)

		it("should return false for non-integer floating-point numbers", function()
			assert.is_false(utils.isInteger(1.23))
			assert.is_false(utils.isInteger(-0.456))
			assert.is_false(utils.isInteger("1.23"))
			assert.is_false(utils.isInteger("-0.456"))
		end)

		it("should return true for integer floating-point numbers", function()
			assert.is_true(utils.isInteger(1.0))
			assert.is_true(utils.isInteger(1.))
			assert.is_true(utils.isInteger(-100.0))
			assert.is_true(utils.isInteger(0.0))
			assert.is_true(utils.isInteger(-0.0))
			assert.is_true(utils.isInteger("1.0"))
			assert.is_true(utils.isInteger("-100.0"))
			assert.is_true(utils.isInteger("1."))
		end)

		it("should return true for integers in scientific notation", function()
			assert.is_true(utils.isInteger("1e3")) -- 1000
			assert.is_true(utils.isInteger("-1e3")) -- -1000
			assert.is_true(utils.isInteger("1.0e3")) -- 1000
			assert.is_true(utils.isInteger("-1.0e3")) -- -1000
			assert.is_true(utils.isInteger("1.23e3")) -- 1230
			assert.is_true(utils.isInteger("-1.23e3")) -- -1230
		end)

		it("should return false for non-integers in scientific notation", function()
			assert.is_false(utils.isInteger("1.23e-3")) -- 0.00123
			assert.is_false(utils.isInteger("-1.23e-3")) -- -0.00123
		end)

		it("should return true for hexadecimal integers and hexadecimal integer floats", function()
			assert.is_true(utils.isInteger("0x1F")) -- 31
			assert.is_true(utils.isInteger("0xABC")) -- 2748
			assert.is_true(utils.isInteger("-0x10")) -- -16
			assert.is_true(utils.isInteger("0x1.8p3")) -- 12.0
		end)

		it("should return false for hexadecimal floats", function()
			assert.is_false(utils.isInteger("-0x1.921fbp+1")) -- ~3.14
		end)

		it("should return false for invalid strings", function()
			assert.is_false(utils.isInteger("123abc"))
			assert.is_false(utils.isInteger("1.2.3"))
			assert.is_false(utils.isInteger("1.0e--2"))
			assert.is_false(utils.isInteger("abc"))
			assert.is_false(utils.isInteger(""))
		end)

		it("should handle edge cases for `inf` and `nan`", function()
			assert.is_false(utils.isInteger(math.huge)) -- Infinity
			assert.is_false(utils.isInteger(-math.huge)) -- -Infinity
			assert.is_false(utils.isInteger(0 / 0)) -- NaN
			assert.is_false(utils.isInteger("inf"))
			assert.is_false(utils.isInteger("-inf"))
			assert.is_false(utils.isInteger("nan"))
		end)

		it("should handle large and small numbers", function()
			assert.is_true(utils.isInteger("1.7976931348623157e+308")) -- Max finite value, treated as integer
			assert.is_false(utils.isInteger("4.9406564584124654e-324")) -- Min positive subnormal value, not an integer
			assert.is_false(utils.isInteger("-4.9406564584124654e-324"))
		end)

		it("should handle negative zero", function()
			assert.is_true(utils.isInteger(-0.0))
			assert.is_true(utils.isInteger("0.0"))
			assert.is_true(utils.isInteger("-0.0"))
		end)

		it("should handle numbers with leading zeros", function()
			assert.is_true(utils.isInteger("000123"))
			assert.is_true(utils.isInteger("000000"))
			assert.is_true(utils.isInteger("-000456"))
		end)

		it("should return false for non-numbers and non-integer strings", function()
			assert.is_false(utils.isInteger({}))
			assert.is_false(utils.isInteger(nil))
			assert.is_false(utils.isInteger(true))
			assert.is_false(utils.isInteger(false))
			assert.is_false(utils.isInteger(function() end))
			assert.is_false(utils.isInteger("true"))
			assert.is_false(utils.isInteger("false"))
			assert.is_false(utils.isInteger("foo"))
			assert.is_false(utils.isInteger("1.234"))
			assert.is_false(utils.isInteger("1.0e-10"))
			assert.is_false(utils.isInteger("1.0e")) -- not a valid lua number
			assert.is_false(utils.isInteger("1.0e-")) -- not a valid lua number
			assert.is_false(utils.isInteger("1.0e+")) -- not a valid lua number
		end)
	end)

	describe("booleanOrBooleanStringToBoolean", function()
		it("should return a boolean as itself", function()
			assert.is_true(utils.booleanOrBooleanStringToBoolean(true))
			assert.is_false(utils.booleanOrBooleanStringToBoolean(false))
		end)

		it("should convert any casing of true or false to the analogous boolean value", function()
			assert.is_true(utils.booleanOrBooleanStringToBoolean("true"))
			assert.is_true(utils.booleanOrBooleanStringToBoolean("True"))
			assert.is_true(utils.booleanOrBooleanStringToBoolean("TRUE"))
			assert.is_true(utils.booleanOrBooleanStringToBoolean("tRuE"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("false"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("False"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("FALSE"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("fAlSe"))
		end)

		it("should not convert other truthy-like string values to boolean", function()
			assert.is_false(utils.booleanOrBooleanStringToBoolean("1"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("yes"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("Yes"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("YES"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("y"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("Y"))
			assert.is_false(utils.booleanOrBooleanStringToBoolean("t"))
			---@ diagnostic disable-next-line: param-type-mismatch
			assert.is_false(utils.booleanOrBooleanStringToBoolean({
				True = true,
			}))
			---@ diagnostic disable-next-line: param-type-mismatch
			assert.is_false(utils.booleanOrBooleanStringToBoolean(nil))
			---@ diagnostic disable-next-line: param-type-mismatch
			assert.is_false(utils.booleanOrBooleanStringToBoolean(1))
		end)
	end)

	describe("lengthOfTable", function()
		it("should throw for non-table values", function()
			assert.has_error(function()
				utils.lengthOfTable(3)
			end, "bad argument #1 to 'for iterator' (table expected, got number)")
			assert.has_error(function()
				utils.lengthOfTable("foo")
			end, "bad argument #1 to 'for iterator' (table expected, got string)")
			assert.has_error(function()
				utils.lengthOfTable(true)
			end, "bad argument #1 to 'for iterator' (table expected, got boolean)")
			assert.has_error(function()
				utils.lengthOfTable(nil)
			end, "bad argument #1 to 'for iterator' (table expected, got nil)")
		end)
		it("should return the length of a table", function()
			assert.are.equal(0, utils.lengthOfTable({}))
			assert.are.equal(3, utils.lengthOfTable({ 1, 2, 3 }))
			assert.are.equal(3, utils.lengthOfTable({ a = 1, b = 2, c = 3 }))
			assert.are.equal(6, utils.lengthOfTable({ 1, 2, 3, a = 1, b = 2, c = 3 }))
			assert.are.equal(3, utils.lengthOfTable({ [1] = 1, [2] = 2, [4] = 4 }))
		end)
	end)

	describe("findInTable", function()
		it("should return nil for an empty table", function()
			local key, value = utils.findInTable({}, function()
				return true
			end)
			assert.is_nil(key)
			assert.is_nil(value)
		end)

		it("should return the key and value for the first entry that matches the predicate", function()
			local input = { a = 1, b = 2, c = 3 }
			local key, value = utils.findInTable(input, function(_, v)
				return v == 2
			end)
			assert.are.equal("b", key)
			assert.are.equal(2, value)
		end)

		it(
			"should return the key and value for the first entry that matches the predicate, even if the key is not a string",
			function()
				local input = { [1] = 1, [2] = 2, [3] = 3 }
				local key, value = utils.findInTable(input, function(_, v)
					return v == 2
				end)
				assert.are.equal(2, key)
				assert.are.equal(2, value)
			end
		)

		it("should return nil if no entries match the predicate", function()
			local input = { a = 1, b = 2, c = 3 }
			local key, value = utils.findInTable(input, function(_, v)
				return v == 4
			end)
			assert.is_nil(key)
			assert.is_nil(value)
		end)

		it("should return the key and value for the first entry that matches the key predicate", function()
			local input = { a = 1, b = 2, c = 3 }
			local key, value = utils.findInTable(input, function(k)
				return k == "b"
			end)
			assert.are.equal("b", key)
			assert.are.equal(2, value)
		end)
	end)

	describe("getTableKeys", function()
		it("should return the keys of a table", function()
			local input = { foo = "bar", baz = "qux" }
			local result = utils.getTableKeys(input)
			table.sort(result)
			assert.are.same({ "baz", "foo" }, result)
		end)

		it("should return an empty table for an empty table", function()
			local input = {}
			local result = utils.getTableKeys(input)
			assert.are.same({}, result)
		end)

		it("should return an empty table for a nil table", function()
			local result = utils.getTableKeys(nil)
			assert.are.same({}, result)
		end)
	end)
end)
