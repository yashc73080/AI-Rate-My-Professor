'use client'
import { Box, Button, Stack, TextField, IconButton } from '@mui/material'
import { Send } from '@mui/icons-material'
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
      p={4}
      bgcolor="#252424"
    >
      <Box
        width="90vw"
        height="90vh"
        maxWidth="1200px"
        display="flex"
        flexDirection="column"
        borderRadius={4}
        boxShadow={3}
        overflow="hidden"
        bgcolor="#3f3d3d"
      >
        <Box
          flex={1}
          overflow="auto"
          p={3}
          display="flex"
          flexDirection="column"
          gap={2}
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              alignSelf={
                message.role === 'assistant' ? 'flex-start' : 'flex-end'
              }
              maxWidth="75%"
              bgcolor={
                message.role === 'assistant' ? '#1669bb' : '#666363'
              }
              color="white"
              borderRadius={2}
              p={2}
              boxShadow={2}
            >
              {message.content}
            </Box>
          ))}
        </Box>
  
        <Box
          display="flex"
          p={2}
          bgcolor="#3f3d3d "
          boxShadow={1}
          alignItems="center"
        >
          <TextField
            variant="outlined"
            fullWidth
            label="Send a Rate My Professor URL or message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            sx={{
              mr: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'white',
                },
                '&:hover fieldset': {
                  borderColor: 'white',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'white',
                },
                '& input': {
                  color: 'white',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'white',
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: 'white',
              },
            }}
          />
          <IconButton color="primary" onClick={sendMessage}>
            <Send  />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}