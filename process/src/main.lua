Handlers.add("test", function()
	return "continue", function(msg)
		print(msg)
		msg.reply({
			Data = "Hello World",
		})
	end
end)
