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
--- Assumes address has been validated as a valid Ethereum address (see utils.isValidEthAddress)
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

return utils
