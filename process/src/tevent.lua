local AOEvent = require("ao_event")
local utils = require("utils")

--- @alias TEvent AOEvent

--- Convenience factory function for pre-populating analytic and msg fields into AOEvents
--- @param msg table
--- @param initialData table<string, any>|nil Optional initial data to populate the event with.
--- @returns TEvent
local function TEvent(msg, initialData)
	local extras = {}
	if msg.Cron then
		extras.Cron = msg.Cron
	end
	if msg.Cast then
		extras.Cast = msg.Cast
	end
	local event = AOEvent(extras)
	event:addFields(msg.Tags or {})
	event:addFieldsIfExist(msg, { "From", "Timestamp", "Action" })
	event:addField("Message-Id", msg.Id)
	event:addField("From-Formatted", utils.formatAddress(msg.From))
	if initialData ~= nil then
		event:addFields(initialData)
	end
	return event
end

return TEvent
