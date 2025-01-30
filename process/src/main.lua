local TEvent = require("tevent")
local utils = require("utils")

Owner = Owner or ao.env.Process.Owner

--- @alias WalletAddress string
--- @alias ProcessId string

-- Tessera are voting tokens, one per WalletAddress
--- @type table<WalletAddress, any>
Tessera = Tessera or {
	[Owner] = true,
}

--- @alias ProposalName string
--- @alias ProposalNumber number

--- @class ProposalData
--- @field proposalNumber ProposalNumber
--- @field type "Add-Controller"|"Remove-Controller"|"Transfer-Process"|"Eval"
--- @field yays table<WalletAddress, any>
--- @field nays table<WalletAddress, any>

--- @class AddControllerProposalData : ProposalData
--- @field controller WalletAddress
--- @field type "Add-Controller"

--- @class RemoveControllerProposalData : ProposalData
--- @field controller WalletAddress
--- @field type "Remove-Controller"

--- @class TransferProcessProposalData : ProposalData
--- @field processId ProcessId
--- @field recipient WalletAddress
--- @field type "Transfer-Process"

--- @class EvalProposalData : ProposalData
--- @field processId ProcessId
--- @field evalStr string
--- @field type "Eval"

--- @alias ProposalDataType AddControllerProposalData|RemoveControllerProposalData|TransferProcessProposalData|EvalProposalData

--- @type ProposalNumber
ProposalNumber = ProposalNumber or 0
--- @type table<ProposalName, ProposalDataType>
Proposals = Proposals or {}

--- @alias Timestamp number

LastKnownMessageTimestamp = LastKnownMessageTimestamp or 0
LastKnownMessageId = LastKnownMessageId or ""

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
			-- These is for handlers that severely modify global state, and where partial updates are dangerous.
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

local function updateLastKnownMessage(msg)
	if msg.Timestamp >= LastKnownMessageTimestamp then
		LastKnownMessageTimestamp = msg.Timestamp
		LastKnownMessageId = msg.Id
	end
end

-- handlers that are critical should raise unhandled errors so the CU will discard the memory on error
local CRITICAL = true

-- Sanitize inputs before every interaction
local function assertAndSanitizeInputs(msg)
	assert(
		-- TODO: replace this with LastKnownMessageTimestamp after node release 23.0.0
		msg.Timestamp and tonumber(msg.Timestamp) >= 0,
		"Timestamp must be greater than or equal to the last known message timestamp of "
			.. LastKnownMessageTimestamp
			.. " but was "
			.. msg.Timestamp
	)
	assert(msg.From, "From is required")
	assert(msg.Tags and type(msg.Tags) == "table", "Tags are required")

	msg.Tags = utils.validateAndSanitizeInputs(msg.Tags)
	msg.From = utils.formatAddress(msg.From)
	msg.Timestamp = msg.Timestamp and tonumber(msg.Timestamp) -- Timestamp should always be provided by the CU
end

addEventingHandler("sanitize", function()
	return "continue"
end, function(msg)
	assertAndSanitizeInputs(msg)
	updateLastKnownMessage(msg)
end, CRITICAL, false)

addEventingHandler(
	"proposeAddController",
	Handlers.utils.hasMatchingTag("Action", "Propose-Add-Controller"),
	function(msg)
		assert(msg.Tags.Controller, "Controller is required")
		assert(not Tessera[msg.Tags.Controller], "Controller already exists")
		assert(Tessera[msg.From], "Sender is not a registered Controller!")
		local proposalName = "Add-Controller_" .. msg.Tags.Controller
		assert(not Proposals[proposalName], "Proposal already exists")
		local vote = msg.Tags.Vote
		if vote ~= nil then
			vote = type(vote) == "string" and string.lower(vote) or "error"
			assert(vote == "yay" or vote == "nay", "Vote, if provided, must be 'yay' or 'nay'")
		end

		ProposalNumber = ProposalNumber + 1

		--- @type AddControllerProposalData
		local newProposal = {
			proposalNumber = ProposalNumber,
			type = "Add-Controller",
			controller = msg.Tags.Controller,
			yays = {},
			nays = {},
		}
		if vote == "yay" then
			newProposal.yays[msg.From] = true
		elseif vote == "nay" then
			newProposal.nays[msg.From] = true
		end
		Proposals[proposalName] = newProposal
		local returnData = utils.deepCopy(newProposal)
		--- @diagnostic disable-next-line: inject-field
		returnData.proposalName = proposalName

		Send(msg, {
			Target = msg.From,
			Action = "Propose-Add-Controller-Notice",
			Data = returnData,
		})
	end
)

addEventingHandler("vote", Handlers.utils.hasMatchingTag("Action", "Vote"), function(msg)
	assert(msg.Tags["Proposal-Number"], "Proposal-Number is required")
	local vote = msg.Tags.Vote
	if vote ~= nil then
		vote = type(vote) == "string" and string.lower(vote) or "error"
	end
	assert(vote and vote == "yay" or vote == "nay", "A Vote of 'yay' or 'nay' is required")
	local _, proposal = utils.findInTable(Proposals, function(_, prop)
		return prop.proposalNumber == msg.Tags["Proposal-Number"]
	end)
	assert(proposal, "Proposal does not exist")
	assert(Tessera[msg.From], "Sender is not a registered Controller!")

	if string.lower(msg.Tags.Vote) == "yay" then
		proposal.yays[msg.From] = true
		proposal.nays[msg.From] = nil
	elseif msg.Tags.Vote == "Nay" then
		proposal.nays[msg.From] = true
		proposal.yays[msg.From] = nil
	end

	-- Check whether the proposal has passed...
	local yaysCount = utils.lengthOfTable(proposal.yays)
	local naysCount = utils.lengthOfTable(proposal.nays)
	local majorityThreshold = math.floor(utils.lengthOfTable(Tessera) / 2) + 1
	if yaysCount >= majorityThreshold then
		-- Proposal has passed
		if proposal.type == "Add-Controller" then
			Tessera[proposal.controller] = true
		elseif proposal.type == "Remove-Controller" then
			Tessera[proposal.controller] = nil
			-- TODO: Implementations for transfer process and eval
		end
		-- TODO: Notify Tessera of result
		Proposals[msg.Tags.ProposalName] = nil
	elseif naysCount >= majorityThreshold then
		-- Proposal has failed
		-- TODO: Notify Tessera of result
		Proposals[msg.Tags.ProposalName] = nil
	end

	Send(msg, {
		Target = msg.From,
		Action = "Vote-Notice",
		Data = {
			ProposalName = msg.Tags.ProposalName,
			Vote = msg.Tags.Vote,
		},
	})
end)

addEventingHandler("controllers", Handlers.utils.hasMatchingTag("Action", "Get-Controllers"), function(msg)
	Send(msg, {
		Target = msg.From,
		Action = "Get-Controllers-Notice",
		Data = Tessera,
	})
end)

addEventingHandler("proposals", Handlers.utils.hasMatchingTag("Action", "Get-Proposals"), function(msg)
	Send(msg, {
		Target = msg.From,
		Action = "Get-Proposals-Notice",
		Data = Proposals,
	})
end)
