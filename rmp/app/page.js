'use client'
import { Box, Button, Stack, TextField } from '@mui/material'
import { useState } from 'react'
import { scrapeData } from './utils/scraping_professor'

export default function Home() {
  const [url, setUrl] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm the Rate My Professor support assistant. How can I help you today?`,
    },
  ])
  const [message, setMessage] = useState('')

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  const sendMessage = async () => {
    if (message.trim() === "") return;
  
    if (isValidUrl(message)) {
      const url = new URL(message);
      if (url.hostname === "www.ratemyprofessors.com") {
        if (url.pathname.startsWith("/professor/")) {
          await handleScrape(message);
        } else if (url.pathname.startsWith("/search/professors/")) {
          await handleBulkScrape(message);
        }
      }
    } else {
      await handleNormalMessage();
    }
  
    setMessage('');
  }

  const handleScrape = async (urlToScrape) => {
    try {
      const result = await scrapeData(urlToScrape);
      if (result.success) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "user", content: urlToScrape },
          { role: "assistant", content: result.message }
        ]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", content: urlToScrape },
        { role: "assistant", content: "Failed to scrape and store data. Please try again." }
      ]);
    }
  };

  const handleNormalMessage = async () => {
    setMessages((prevMessages) => [
      ...prevMessages,
      {role: 'user', content: message},
      {role: 'assistant', content: ''},
    ])

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([...messages, {role: 'user', content: message}]),
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          const updatedMessages = prevMessages.slice(0, -1);
          return [
            ...updatedMessages,
            { ...lastMessage, content: lastMessage.content + text }
          ];
        });
      }
    }
  }

  const handleBulkScrape = async (urlToScrape) => {
    try {
      const response = await fetch('/api/bulk_scrape_professors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlToScrape }),
      });
  
      const result = await response.json();
  
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", content: urlToScrape },
        { role: "assistant", content: result.message }
      ]);
    } catch (error) {
      console.error('Error:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", content: urlToScrape },
        { role: "assistant", content: "Failed to scrape and store bulk data. Please try again." }
      ]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Stack
        direction={'column'}
        width="500px"
        height="700px"
        border="1px solid black"
        p={2}
        spacing={3}
      >
        <Stack
          direction={'column'}
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={
                message.role === 'assistant' ? 'flex-start' : 'flex-end'
              }
            >
              <Box
                bgcolor={
                  message.role === 'assistant'
                    ? 'primary.main'
                    : 'secondary.main'
                }
                color="white"
                borderRadius={16}
                p={3}
              >
                {message.content}
              </Box>
            </Box>
          ))}
        </Stack>
        <Stack direction={'row'} spacing={2}>
          <TextField
            label="Send a Rate My Professors link or ask a question..."
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button variant="contained" onClick={sendMessage}>
            Send
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}