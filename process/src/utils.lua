local utils = {}

--- Converts a string to its hexadecimal representation.
--- @param s string The input string.
--- @param ln? number - The number of characters per line. If not provided, the output will be a single line.
--- @param sep? string - The separator between each pair of hexadecimal characters. Defaults to an empty string.
--- @return string The - hexadecimal representation of the input string.
local function stringToHex(s, ln, sep)
	if #s == 0 then
		return ""
	end
	if not ln then
		return (s:gsub(".", function(c)
			return string.format("%02x", string.byte(c))
		end))
	end
	sep = sep or ""
	local t = {}
	for i = 1, #s - 1 do
		t[#t + 1] = string.format("%02x%s", s:byte(i), (i % ln == 0) and "\n" or sep)
	end
	t[#t + 1] = string.format("%02x", s:byte(#s))
	return table.concat(t)
end

local ROUNDS = 24

local roundConstants = {
	0x0000000000000001,
	0x0000000000008082,
	0x800000000000808A,
	0x8000000080008000,
	0x000000000000808B,
	0x0000000080000001,
	0x8000000080008081,
	0x8000000000008009,
	0x000000000000008A,
	0x0000000000000088,
	0x0000000080008009,
	0x000000008000000A,
	0x000000008000808B,
	0x800000000000008B,
	0x8000000000008089,
	0x8000000000008003,
	0x8000000000008002,
	0x8000000000000080,
	0x000000000000800A,
	0x800000008000000A,
	0x8000000080008081,
	0x8000000000008080,
	0x0000000080000001,
	0x8000000080008008,
}

local rotationOffsets = {
	-- ordered for [x][y] dereferencing, so appear flipped here:
	{ 0, 36, 3, 41, 18 },
	{ 1, 44, 10, 45, 2 },
	{ 62, 6, 43, 15, 61 },
	{ 28, 55, 25, 21, 56 },
	{ 27, 20, 39, 8, 14 },
}

-- the full permutation function
local function keccakF(st)
	local permuted = st.permuted
	local parities = st.parities
	for round = 1, ROUNDS do
		-- theta()
		for x = 1, 5 do
			parities[x] = 0
			local sx = st[x]
			for y = 1, 5 do
				parities[x] = parities[x] ~ sx[y]
			end
		end
		--
		-- unroll the following loop
		--for x = 1,5 do
		--	local p5 = parities[(x)%5 + 1]
		--	local flip = parities[(x-2)%5 + 1] ~ ( p5 << 1 | p5 >> 63)
		--	for y = 1,5 do st[x][y] = st[x][y] ~ flip end
		--end
		local p5, flip, s
		--x=1
		p5 = parities[2]
		flip = parities[5] ~ (p5 << 1 | p5 >> 63)
		s = st[1]
		for y = 1, 5 do
			s[y] = s[y] ~ flip
		end
		--x=2
		p5 = parities[3]
		flip = parities[1] ~ (p5 << 1 | p5 >> 63)
		s = st[2]
		for y = 1, 5 do
			s[y] = s[y] ~ flip
		end
		--x=3
		p5 = parities[4]
		flip = parities[2] ~ (p5 << 1 | p5 >> 63)
		s = st[3]
		for y = 1, 5 do
			s[y] = s[y] ~ flip
		end
		--x=4
		p5 = parities[5]
		flip = parities[3] ~ (p5 << 1 | p5 >> 63)
		s = st[4]
		for y = 1, 5 do
			s[y] = s[y] ~ flip
		end
		--x=5
		p5 = parities[1]
		flip = parities[4] ~ (p5 << 1 | p5 >> 63)
		s = st[5]
		for y = 1, 5 do
			s[y] = s[y] ~ flip
		end

		-- rhopi()
		for y = 1, 5 do
			local py = permuted[y]
			local r
			for x = 1, 5 do
				s, r = st[x][y], rotationOffsets[x][y]
				py[(2 * x + 3 * y) % 5 + 1] = (s << r | s >> (64 - r))
			end
		end

		-- chi() - unroll the loop
		--for x = 1,5 do
		--	for y = 1,5 do
		--		local combined = (~ permuted[(x)%5 +1][y]) & permuted[(x+1)%5 +1][y]
		--		st[x][y] = permuted[x][y] ~ combined
		--	end
		--end

		local p, p1, p2
		--x=1
		s, p, p1, p2 = st[1], permuted[1], permuted[2], permuted[3]
		for y = 1, 5 do
			s[y] = p[y] ~ ~p1[y] & p2[y]
		end
		--x=2
		s, p, p1, p2 = st[2], permuted[2], permuted[3], permuted[4]
		for y = 1, 5 do
			s[y] = p[y] ~ ~p1[y] & p2[y]
		end
		--x=3
		s, p, p1, p2 = st[3], permuted[3], permuted[4], permuted[5]
		for y = 1, 5 do
			s[y] = p[y] ~ ~p1[y] & p2[y]
		end
		--x=4
		s, p, p1, p2 = st[4], permuted[4], permuted[5], permuted[1]
		for y = 1, 5 do
			s[y] = p[y] ~ ~p1[y] & p2[y]
		end
		--x=5
		s, p, p1, p2 = st[5], permuted[5], permuted[1], permuted[2]
		for y = 1, 5 do
			s[y] = p[y] ~ ~p1[y] & p2[y]
		end

		-- iota()
		st[1][1] = st[1][1] ~ roundConstants[round]
	end
end

local function absorb(st, buffer, algorithm)
	local blockBytes = st.rate / 8
	local blockWords = blockBytes / 8

	-- append 0x01 byte and pad with zeros to block size (rate/8 bytes)
	local totalBytes = #buffer + 1
	-- for keccak (2012 submission), the padding is byte 0x01 followed by zeros
	-- for SHA3 (NIST, 2015), the padding is byte 0x06 followed by zeros

	if algorithm == "keccak" then
		buffer = buffer .. ("\x01" .. string.char(0):rep(blockBytes - (totalBytes % blockBytes)))
	end

	if algorithm == "sha3" then
		buffer = buffer .. ("\x06" .. string.char(0):rep(blockBytes - (totalBytes % blockBytes)))
	end

	totalBytes = #buffer

	--convert data to an array of u64
	local words = {}
	for i = 1, totalBytes - (totalBytes % 8), 8 do
		words[#words + 1] = string.unpack("<I8", buffer, i)
	end

	local totalWords = #words
	-- OR final word with 0x80000000 to set last bit of state to 1
	words[totalWords] = words[totalWords] | 0x8000000000000000

	-- XOR blocks into state
	for startBlock = 1, totalWords, blockWords do
		local offset = 0
		for y = 1, 5 do
			for x = 1, 5 do
				if offset < blockWords then
					local index = startBlock + offset
					st[x][y] = st[x][y] ~ words[index]
					offset = offset + 1
				end
			end
		end
		keccakF(st)
	end
end

-- returns [rate] bits from the state, without permuting afterward.
-- Only for use when the state will immediately be thrown away,
-- and not used for more output later
local function squeeze(st)
	local blockBytes = st.rate / 8
	local blockWords = blockBytes / 4
	-- fetch blocks out of state
	local hasht = {}
	local offset = 1
	for y = 1, 5 do
		for x = 1, 5 do
			if offset < blockWords then
				hasht[offset] = string.pack("<I8", st[x][y])
				offset = offset + 1
			end
		end
	end
	return table.concat(hasht)
end

local function keccakHash(rate, length, data, algorithm)
	local state = { { 0, 0, 0, 0, 0 }, { 0, 0, 0, 0, 0 }, { 0, 0, 0, 0, 0 }, { 0, 0, 0, 0, 0 }, { 0, 0, 0, 0, 0 } }
	state.rate = rate
	-- these are allocated once, and reused
	state.permuted = { {}, {}, {}, {}, {} }
	state.parities = { 0, 0, 0, 0, 0 }
	absorb(state, data, algorithm)
	local encoded = squeeze(state):sub(1, length / 8)

	local public = {}

	public.asString = function()
		return encoded
	end

	public.asHex = function()
		return stringToHex(encoded)
	end

	return public
end

local function keccak256(data)
	return keccakHash(1088, 256, data, "keccak")
end

--- Converts an address to EIP-55 checksum format
--- Assumes address has been validated as a valid Ethereum address
--- Reference: https://eips.ethereum.org/EIPS/eip-55
--- @param address string The address to convert
--- @return string formattedAddress - the EIP-55 checksum formatted address
function utils.formatEIP55Address(address)
	local hex = string.lower(string.sub(address, 3))

	local hash = keccak256(hex)
	local hashHex = hash.asHex()

	local checksumAddress = "0x"

	for i = 1, #hashHex do
		local hexChar = string.sub(hashHex, i, i)
		local hexCharValue = tonumber(hexChar, 16)
		local char = string.sub(hex, i, i)
		if hexCharValue > 7 then
			char = string.upper(char)
		end
		checksumAddress = checksumAddress .. char
	end

	return checksumAddress
end

--- Checks if an address looks like an unformatted Ethereum address
--- @param address string The address to check
--- @return boolean isValidUnformattedEthAddress - whether the address is a valid unformatted Ethereum address
function utils.isValidUnformattedEthAddress(address)
	return type(address) == "string" and #address == 42 and string.match(address, "^0x[%x]+$") ~= nil
end

--- Formats an address to EIP-55 checksum format if it is a valid Ethereum address
--- @param address string The address to format
--- @return string formattedAddress - the EIP-55 checksum formatted address
function utils.formatAddress(address)
	if utils.isValidUnformattedEthAddress(address) then
		return utils.formatEIP55Address(address)
	end
	return address
end

function utils.toTrainCase(str)
	-- Replace underscores and spaces with hyphens
	str = str:gsub("[_%s]+", "-")

	-- Handle camelCase and PascalCase by adding a hyphen before uppercase letters that follow lowercase letters
	str = str:gsub("(%l)(%u)", "%1-%2")

	-- Capitalize the first letter of every word (after hyphen) and convert to Train-Case
	str = str:gsub("(%a)([%w]*)", function(first, rest)
		-- If the word is all uppercase (like "GW"), preserve it
		if first:upper() == first and rest:upper() == rest then
			return first:upper() .. rest
		else
			return first:upper() .. rest:lower()
		end
	end)
	return str
end

--- Checks if a value is an integer
--- @param value any The value to check
--- @return boolean isInteger - whether the value is an integer
function utils.isInteger(value)
	if value == nil then
		return false
	end
	if type(value) == "string" then
		value = tonumber(value)
	end
	return type(value) == "number" and value % 1 == 0
end

--- @param value string|boolean
--- @return boolean
function utils.booleanOrBooleanStringToBoolean(value)
	if type(value) == "boolean" then
		return value
	end
	return type(value) == "string" and string.lower(value) == "true"
end

--- Sanitizes inputs to ensure they are valid strings
--- @param table table The table to sanitize
--- @return table sanitizedTable - the sanitized table
function utils.validateAndSanitizeInputs(table)
	assert(type(table) == "table", "Table must be a table")
	local sanitizedTable = {}
	for key, value in pairs(table) do
		assert(type(key) == "string", "Key must be a string")
		assert(
			type(value) == "string" or type(value) == "number" or type(value) == "boolean",
			"Value must be a string, integer, or boolean"
		)
		if type(value) == "string" then
			assert(#key > 0, "Key cannot be empty")
			assert(#value > 0, "Value for " .. key .. " cannot be empty")
			assert(not string.match(key, "^%s+$"), "Key cannot be only whitespace")
			assert(not string.match(value, "^%s+$"), "Value for " .. key .. " cannot be only whitespace")
		end
		if type(value) == "boolean" then
			assert(value == true or value == false, "Boolean value must be true or false")
		end
		if type(value) == "number" then
			assert(utils.isInteger(value), "Number must be an integer")
		end
		sanitizedTable[key] = value
	end

	local knownAddressTags = {
		"Process-Id",
		"Controller",
	}

	for _, tagName in ipairs(knownAddressTags) do
		-- Format all incoming addresses
		sanitizedTable[tagName] = sanitizedTable[tagName] and utils.formatAddress(sanitizedTable[tagName]) or nil
	end

	local knownNumberTags = {
		"Timestamp",
		"Proposal-Number",
	}
	for _, tagName in ipairs(knownNumberTags) do
		-- Format all incoming numbers
		sanitizedTable[tagName] = sanitizedTable[tagName] and tonumber(sanitizedTable[tagName]) or nil
	end

	local knownBooleanTags = {}
	for _, tagName in ipairs(knownBooleanTags) do
		sanitizedTable[tagName] = sanitizedTable[tagName]
				and utils.booleanOrBooleanStringToBoolean(sanitizedTable[tagName])
			or nil
	end
	return sanitizedTable
end

--- Gets the length of a table
--- @param table table The table to get the length of
--- @return number length - the length of the table
function utils.lengthOfTable(table)
	local count = 0
	for _, val in pairs(table) do
		if val then
			count = count + 1
		end
	end
	return count
end

function utils.createLookupTable(tbl, valueFn)
	local lookupTable = {}
	valueFn = valueFn or function()
		return true
	end
	for key, value in pairs(tbl or {}) do
		lookupTable[value] = valueFn(key, value)
	end
	return lookupTable
end

--- Deep copies a table with optional exclusion of specified fields, including nested fields
--- Preserves proper sequential ordering of array tables when some of the excluded nested keys are array indexes
--- @generic T: table|nil
--- @param original T The table to copy
--- @param excludedFields table|nil An array of keys or dot-separated key paths to exclude from the deep copy
--- @return T The deep copy of the table or nil if the original is nil
function utils.deepCopy(original, excludedFields)
	if not original then
		return nil
	end

	if type(original) ~= "table" then
		return original
	end

	-- Fast path: If no excluded fields, copy directly
	if not excludedFields or #excludedFields == 0 then
		local copy = {}
		for key, value in pairs(original) do
			if type(value) == "table" then
				copy[key] = utils.deepCopy(value) -- Recursive copy for nested tables
			else
				copy[key] = value
			end
		end
		return copy
	end

	-- If excludes are provided, create a lookup table for excluded fields
	local excluded = utils.createLookupTable(excludedFields)

	-- Helper function to check if a key path is excluded
	local function isExcluded(keyPath)
		for excludedKey in pairs(excluded) do
			if keyPath == excludedKey or keyPath:match("^" .. excludedKey .. "%.") then
				return true
			end
		end
		return false
	end

	-- Recursive function to deep copy with nested field exclusion
	local function deepCopyHelper(orig, path)
		if type(orig) ~= "table" then
			return orig
		end

		local result = {}
		local isArray = true

		-- Check if all keys are numeric and sequential
		for key in pairs(orig) do
			if type(key) ~= "number" or key % 1 ~= 0 then
				isArray = false
				break
			end
		end

		if isArray then
			-- Collect numeric keys in sorted order for sequential reindexing
			local numericKeys = {}
			for key in pairs(orig) do
				table.insert(numericKeys, key)
			end
			table.sort(numericKeys)

			local index = 1
			for _, key in ipairs(numericKeys) do
				local keyPath = path and (path .. "." .. key) or tostring(key)
				if not isExcluded(keyPath) then
					result[index] = deepCopyHelper(orig[key], keyPath) -- Sequentially reindex
					index = index + 1
				end
			end
		else
			-- Handle non-array tables (dictionaries)
			for key, value in pairs(orig) do
				local keyPath = path and (path .. "." .. key) or key
				if not isExcluded(keyPath) then
					result[key] = deepCopyHelper(value, keyPath)
				end
			end
		end

		return result
	end

	-- Use the exclusion-aware deep copy helper
	return deepCopyHelper(original, nil)
end

--- Finds an element in an array that matches a predicate
--- @param tbl table The table to search
--- @param predicate fun(key, value) : boolean The predicate to match
--- @return any|nil,any|nil # The found key and value or nils if not found
function utils.findInTable(tbl, predicate)
	for key, value in pairs(tbl) do
		if predicate(key, value) then
			return key, value
		end
	end
	return nil, nil
end

return utils
