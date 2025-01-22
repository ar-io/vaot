local TEvent = require("tevent")
local utils = require("utils")

--- @alias WalletAddress string

-- Tessera are voting tokens, one per WalletAddress
--- @type WalletAddress[]
Tessera = Tessera or {}

Proposals = Proposals or {}

--- @alias Timestamp number

local function eventingPcall(event, onError, fnToCall, ...)
	local status, result = pcall(fnToCall, ...)
	if not status then
		onError(result)
		event:addField("Error", result)
		return status, result
	end
	return status, result
end

--- @class ParsedMessage
--- @field Id string
--- @field Action string
--- @field From string
--- @field Timestamp Timestamp
--- @field Tags table<string, any>
--- @field ioEvent TEvent
--- @field Cast boolean?
--- @field reply? fun(response: any)

--- @param msg ParsedMessage
--- @param response any
local function Send(msg, response)
	if msg.reply then
		--- Reference: https://github.com/permaweb/aos/blob/main/blueprints/patch-legacy-reply.lua
		msg.reply(response)
	else
		ao.send(response)
	end
end

--- @param handlerName string
--- @param pattern fun(msg: ParsedMessage):'continue'|boolean
--- @param handleFn fun(msg: ParsedMessage)
--- @param critical boolean?
--- @param printEvent boolean?
local function addEventingHandler(handlerName, pattern, handleFn, critical, printEvent)
	critical = critical or false
	printEvent = printEvent == nil and true or printEvent
	Handlers.add(handlerName, pattern, function(msg)
		-- add an TEvent to the message if it doesn't exist
		msg.ioEvent = msg.ioEvent or TEvent(msg)
		-- global handler for all eventing errors, so we can log them and send a notice to the sender for non critical errors and discard the memory on critical errors
		local status, resultOrError = eventingPcall(msg.ioEvent, function(error)
			--- non critical errors will send an invalid notice back to the caller with the error information, memory is not discarded
			Send(msg, {
				Target = msg.From,
				Action = "Invalid-" .. utils.toTrainCase(handlerName) .. "-Notice",
				Error = tostring(error),
				Data = tostring(error),
			})
		end, handleFn, msg)
		if not status and critical then
			local errorEvent = TEvent(msg)
			-- For critical handlers we want to make sure the event data gets sent to the CU for processing, but that the memory is discarded on failures
			-- These handlers (distribute, prune) severely modify global state, and partial updates are dangerous.
			-- So we json encode the error and the event data and then throw, so the CU will discard the memory and still process the event data.
			-- An alternative approach is to modify the implementation of ao.result - to also return the Output on error.
			-- Reference: https://github.com/permaweb/ao/blob/76a618722b201430a372894b3e2753ac01e63d3d/dev-cli/src/starters/lua/ao.lua#L284-L287
			local errorWithEvent = tostring(resultOrError) .. "\n" .. errorEvent:toJSON()
			error(errorWithEvent, 0) -- 0 ensures not to include this line number in the error message
		end
		if printEvent then
			msg.ioEvent:printEvent()
		end
	end)
end

addEventingHandler("test", function()
	return "continue"
end, function(msg)
	print(msg)
	Send(msg, {
		Data = "Hello World",
	})
end)
