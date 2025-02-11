local TEvent = require("tevent")
local utils = require("utils")

Owner = Owner or ao.env.Process.Owner

--- @alias WalletAddress string
--- @alias ProcessId string
--- @alias MessageId string

-- Controllers can create action proposals and vote on them
--- @type table<WalletAddress, any>
Controllers = Controllers or {
	[Owner] = true,
}

--- @alias ProposalName string
--- @alias ProposalNumber number

--- @class ProposalData
--- @field proposalNumber ProposalNumber
--- @field msgId MessageId
--- @field type "Add-Controller"|"Remove-Controller"|"Transfer-Process"|"Eval"
--- @field yays table<WalletAddress, any> # a lookup table of WalletAddresses that have voted yay. Values irrelevant.
--- @field nays table<WalletAddress, any> # a lookup table of WalletAddresses that have voted nay. Values irrelevant.

--- @class ControllerProposalData : ProposalData
--- @field controller WalletAddress
--- @field type "Add-Controller"|"Remove-Controller"

--- @class EvalProposalData : ProposalData
--- @field processId ProcessId
--- @field evalStr string
--- @field type "Eval"

local SupportedProposalTypes = {
	["Add-Controller"] = true,
	["Remove-Controller"] = true,
	["Transfer-Process"] = true,
	["Eval"] = true,
}

--- @alias ProposalDataType ControllerProposalData|EvalProposalData

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
--- @field aoEvent TEvent
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
		msg.aoEvent = msg.aoEvent or TEvent(msg)
		-- global handler for all eventing errors, so we can log them and send a notice to the sender for non critical errors and discard the memory on critical errors
		local status, resultOrError = eventingPcall(msg.aoEvent, function(error)
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
			-- These are for handlers that severely modify global state, and where partial updates are dangerous.
			-- So we json encode the error and the event data and then throw, so the CU will discard the memory and still process the event data.
			-- An alternative approach is to modify the implementation of ao.result - to also return the Output on error.
			-- Reference: https://github.com/permaweb/ao/blob/76a618722b201430a372894b3e2753ac01e63d3d/dev-cli/src/starters/lua/ao.lua#L284-L287
			local errorWithEvent = tostring(resultOrError) .. "\n" .. errorEvent:toJSON()
			error(errorWithEvent, 0) -- 0 ensures not to include this line number in the error message
		end
		if printEvent then
			msg.aoEvent:printEvent()
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

--- @param proposalName ProposalName
--- @param msg ParsedMessage
function handleMaybeVoteQuorum(proposalName, msg)
	-- Check whether the proposal has passed...
	local proposal = Proposals[proposalName]
	local yaysCount = utils.lengthOfTable(proposal.yays)
	local naysCount = utils.lengthOfTable(proposal.nays)
	local passThreshold = math.floor(utils.lengthOfTable(Controllers) / 2) + 1
	local controllersCount = utils.lengthOfTable(Controllers)
	local failThreshold = math.max(controllersCount - passThreshold, 1)

	msg.aoEvent:addField("Controllers-Count", utils.lengthOfTable(Controllers))
	msg.aoEvent:addField("Controllers", utils.getTableKeys(Controllers))
	msg.aoEvent:addField("Proposal-Number", proposal.proposalNumber)
	msg.aoEvent:addField("Proposal-Name", proposalName)
	msg.aoEvent:addField("Proposal-Type", proposal.type)
	msg.aoEvent:addField("Yays-Count", yaysCount)
	msg.aoEvent:addField("Yays", utils.getTableKeys(proposal.yays))
	msg.aoEvent:addField("Nays-Count", naysCount)
	msg.aoEvent:addField("Nays", utils.getTableKeys(proposal.nays))
	msg.aoEvent:addField("Pass-Threshold", passThreshold)
	msg.aoEvent:addField("Fail-Threshold", failThreshold)
	if proposal.controller then
		msg.aoEvent:addField("Controller", proposal.controller)
	end
	if proposal.processId then
		msg.aoEvent:addField("Process-Id", proposal.processId)
	end

	--- @param accepted boolean
	local function notifyProposalComplete(accepted)
		local returnData = utils.deepCopy(proposal)
		--- @diagnostic disable-next-line: inject-field
		returnData.proposalName = proposalName
		for address, _ in pairs(Controllers) do
			Send(msg, {
				Target = address,
				Action = accepted and "Proposal-Accepted-Notice" or "Proposal-Rejected-Notice",
				Data = returnData,
			})
		end
	end

	if yaysCount >= passThreshold then
		-- Proposal has passed
		msg.aoEvent:addField("Proposal-Status", "Passed")
		if proposal.type == "Add-Controller" then
			Controllers[proposal.controller] = true
		elseif proposal.type == "Remove-Controller" then
			Controllers[proposal.controller] = nil
		elseif proposal.type == "Eval" then
			Send(msg, {
				Target = proposal.processId,
				Action = "Eval",
				["Proposal-Number"] = tostring(proposal.proposalNumber),
				Data = proposal.evalStr,
			})
		else
			error("Unknown proposal type: " .. proposal.type)
		end

		Proposals[proposalName] = nil
		notifyProposalComplete(true)
	elseif naysCount >= failThreshold then
		-- Proposal has failed
		msg.aoEvent:addField("Proposal-Status", "Failed")
		Proposals[proposalName] = nil
		notifyProposalComplete(false)
	else
		-- No quorum yet
		msg.aoEvent:addField("Proposal-Status", "In Progress")
	end
end

addEventingHandler("propose", Handlers.utils.hasMatchingTag("Action", "Propose"), function(msg)
	assert(Controllers[msg.From], "Sender is not a registered Controller!")
	assert(
		SupportedProposalTypes[msg.Tags["Proposal-Type"] or "unknown"],
		"Proposal-Type is required and must be one of: 'Add-Controller', 'Remove-Controller', or 'Eval'"
	)
	local vote = msg.Tags.Vote
	if vote ~= nil then
		vote = type(vote) == "string" and string.lower(vote) or "error"
		assert(vote == "yay" or vote == "nay", "Vote, if provided, must be 'yay' or 'nay'")
	end

	local proposalName
	--- @type ControllerProposalData|EvalProposalData|nil
	local newProposal
	if msg.Tags["Proposal-Type"] == "Add-Controller" or msg.Tags["Proposal-Type"] == "Remove-Controller" then
		local controller = msg.Tags.Controller
		assert(controller and type(controller) == "string" and #controller > 0, "Controller is required")
		local shouldExist = msg.Tags["Proposal-Type"] == "Remove-Controller"
		assert(
			(Controllers[msg.Tags.Controller] ~= nil) == shouldExist,
			shouldExist and "Controller is not recognized" or "Controller already exists"
		)
		proposalName = msg.Tags["Proposal-Type"] .. "_" .. msg.Tags.Controller
		assert(not Proposals[proposalName], "Proposal already exists")

		ProposalNumber = ProposalNumber + 1

		--- @type ControllerProposalData
		newProposal = {
			proposalNumber = ProposalNumber,
			msgId = msg.Id,
			type = msg.Tags["Proposal-Type"],
			controller = msg.Tags.Controller,
			yays = {},
			nays = {},
		}
	elseif msg.Tags["Proposal-Type"] == "Eval" then
		local processId = msg.Tags["Process-Id"]
		assert(processId and type(processId) == "string", "Process-Id is required")
		local evalStr = msg.Data
		assert(evalStr and type(evalStr) == "string" and #evalStr > 0, "Eval string is expected in message Data")
		proposalName = msg.Tags["Proposal-Type"] .. "_" .. processId .. "_" .. msg.Id
		assert(not Proposals[proposalName], "Proposal already exists")

		ProposalNumber = ProposalNumber + 1
		--- @type EvalProposalData
		newProposal = {
			proposalNumber = ProposalNumber,
			msgId = msg.Id,
			type = msg.Tags["Proposal-Type"],
			processId = processId,
			evalStr = evalStr,
			yays = {},
			nays = {},
		}
	end
	assert(proposalName, "proposalName not initialized")
	assert(newProposal, "newProposal not initialized")

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
		Action = "Propose-" .. msg.Tags["Proposal-Type"] .. "-Notice",
		Data = returnData,
	})

	handleMaybeVoteQuorum(proposalName, msg)
end)

addEventingHandler("vote", Handlers.utils.hasMatchingTag("Action", "Vote"), function(msg)
	assert(Controllers[msg.From], "Sender is not a registered Controller!")
	assert(msg.Tags["Proposal-Number"], "Proposal-Number is required")
	local vote = msg.Tags.Vote
	assert(vote and vote == "yay" or vote == "nay", "A Vote of 'yay' or 'nay' is required")
	local proposalName, proposal = utils.findInTable(Proposals, function(_, prop)
		return prop.proposalNumber == msg.Tags["Proposal-Number"]
	end)
	assert(proposal, "Proposal does not exist")

	if vote == "yay" then
		proposal.yays[msg.From] = true
		proposal.nays[msg.From] = nil
	elseif vote == "nay" then
		proposal.nays[msg.From] = true
		proposal.yays[msg.From] = nil
	end

	Send(msg, {
		Target = msg.From,
		Action = "Vote-Notice",
		Data = proposal,
	})

	handleMaybeVoteQuorum(proposalName, msg)
end)

addEventingHandler("controllers", Handlers.utils.hasMatchingTag("Action", "Get-Controllers"), function(msg)
	Send(msg, {
		Target = msg.From,
		Action = "Get-Controllers-Notice",
		Data = utils.getTableKeys(Controllers),
	})
end)

addEventingHandler("proposals", Handlers.utils.hasMatchingTag("Action", "Get-Proposals"), function(msg)
	Send(msg, {
		Target = msg.From,
		Action = "Get-Proposals-Notice",
		Data = Proposals,
	})
end)
