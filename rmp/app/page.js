'use client'
import { Box, Button, TextField, IconButton, Select, MenuItem, FormControl, InputLabel, CircularProgress } from '@mui/material';
import { Send } from '@mui/icons-material'
import React, { useState, useEffect, useRef } from 'react';
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
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);

  const [selectedSchool, setSelectedSchool] = useState('');
  const schools = [
    { value: '', label: 'General (No specific school)' },
    { value: 'Rutgers', label: 'Rutgers University-New Brunswick' },
    // Add more colleges here in the future
  ];

  const isRmpLink = (url) => {
    return url.includes('ratemyprofessors.com');
  };

  const sendMessage = async () => {
    if (message.trim() === "") return;

    if (isRmpLink(message)) {
      await handleScrape(message);
    } else {
      await handleNormalMessage();
    }

    setMessage('');
  }

  const handleScrape = async (urlToScrape) => {
    setIsScrapingLoading(true);
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
    } finally {
      setIsScrapingLoading(false);
      setUrl(''); // Clear the URL input after scraping
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
      body: JSON.stringify({
        messages: [...messages, {role: 'user', content: message}],
        selectedSchool: selectedSchool,
        // isRmpLink: isRmpLink(message)
      }),
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


  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
        maxWidth="1200px"
        display="flex"
        flexDirection="column"
        gap={3}
      >
        {/* Chatbot Interface */}
        <Box
          height="70vh"
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
            <div ref={messagesEndRef} />
          </Box>
    
          <Box
            display="flex"
            p={2}
            bgcolor="#3f3d3d"
            boxShadow={1}
            alignItems="center"
          >
            <TextField
              variant="outlined"
              fullWidth
              label="Send a message"
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
              <Send />
            </IconButton>
          </Box>
        </Box>

        {/* School Selection and URL Input Boxes */}
        <Box display="flex" gap={3}>
          {/* School Selection Box */}
          <Box
            flex={1}
            display="flex"
            p={2}
            bgcolor="#3f3d3d"
            boxShadow={3}
            borderRadius={4}
            alignItems="center"
          >
            <FormControl fullWidth variant="outlined">
            <InputLabel
              id="school-select-label"
              sx={{
                color: 'white',
                '&.Mui-focused': {
                  color: 'white',
                },
              }}
            >
              Select a School
            </InputLabel>
              <Select
                labelId="school-select-label"
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                label="Select a School"
                sx={{
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'white',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'white',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'white',
                  },
                  '& .MuiSvgIcon-root': {
                    color: 'white',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: '#3f3d3d',
                      '& .MuiMenuItem-root': {
                        color: 'white',
                      },
                      '& .MuiMenuItem-root.Mui-selected': {
                        bgcolor: '#5a5959',
                      },
                      '& .MuiMenuItem-root.Mui-selected:hover': {
                        bgcolor: '#5a5959',
                      },
                    },
                  },
                }}
              >
                {schools.map((school) => (
                  <MenuItem key={school.value} value={school.value}>
                    {school.label}
                  </MenuItem>
                ))}
                <MenuItem disabled sx={{ color: 'white', opacity: 0.7 }}>
                  We will add support for more schools in the future!
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* URL Input Box */}
          <Box
            flex={1}
            display="flex"
            p={2}
            bgcolor="#3f3d3d"
            boxShadow={3}
            borderRadius={4}
            alignItems="center"
          >
            <TextField
              variant="outlined"
              fullWidth
              label="Enter a Rate My Professor URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
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
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => handleScrape(url)}
              disabled={isScrapingLoading}
            >
              {isScrapingLoading ? <CircularProgress size={24} color="inherit" /> : 'Scrape'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}