import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ImageIcon, MessageCircleMore, Search, SendHorizonal } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useDispatch, useSelector } from 'react-redux'
import moment from 'moment'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { addMessage, fetchMessages, resetMessages } from '../features/messages/messagesSlice'

const getEntityId = (value) => typeof value === 'string' ? value : value?._id

const getPreviewText = (message, currentUserId) => {
  if (!message) {
    return 'Start a conversation'
  }

  const prefix = getEntityId(message.from_user_id) === currentUserId ? 'You: ' : ''
  const content = message.text?.trim() || (message.message_type === 'image' ? 'Sent a photo' : 'New message')
  return `${prefix}${content}`
}

const Messages = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { userId } = useParams()
  const { getToken } = useAuth()

  const currentUser = useSelector((state) => state.user.value)
  const connections = useSelector((state) => state.connections.connections)
  const { messages, inboxRefreshKey } = useSelector((state) => state.messages)

  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  const fetchConversations = async ({ showLoader = false, showError = true } = {}) => {
    try {
      if (showLoader) {
        setLoadingConversations(true)
      }

      const token = await getToken()
      const { data } = await api.get('/api/message/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (data.success) {
        setConversations(data.conversations)
      } else if (showError) {
        toast.error(data.message)
      }
    } catch (error) {
      if (showError) {
        toast.error(error.message)
      }
    }

    if (showLoader) {
      setLoadingConversations(false)
    }
  }

  const fetchConversationMessages = async (targetUserId) => {
    if (!targetUserId) {
      dispatch(resetMessages())
      return
    }

    try {
      const token = await getToken()
      dispatch(fetchMessages({ token, userId: targetUserId }))
      fetchConversations({ showError: false })
    } catch (error) {
      toast.error(error.message)
    }
  }

  useEffect(() => {
    if (currentUser?._id) {
      fetchConversations({ showLoader: true })
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser?._id) {
      return
    }

    fetchConversations({ showError: false })
  }, [inboxRefreshKey, currentUser])

  useEffect(() => {
    if (!currentUser?._id) {
      return
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchConversations({ showError: false })
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [currentUser])

  useEffect(() => {
    dispatch(resetMessages())
    fetchConversationMessages(userId)
  }, [userId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedConversation = useMemo(() => {
    if (!userId) {
      return null
    }

    const matchedConversation = conversations.find(
      (conversation) => getEntityId(conversation.user) === userId
    )

    if (matchedConversation) {
      return matchedConversation
    }

    const fallbackConnection = connections.find((connection) => connection._id === userId)
    if (!fallbackConnection) {
      return null
    }

    return {
      user: fallbackConnection,
      lastMessage: null,
      unreadCount: 0,
    }
  }, [userId, conversations, connections])

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return conversations
    }

    return conversations.filter((conversation) => {
      const fullName = conversation.user?.full_name?.toLowerCase() || ''
      const username = conversation.user?.username?.toLowerCase() || ''
      return fullName.includes(query) || username.includes(query)
    })
  }, [conversations, search])

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }, [messages])

  const handleConversationSelect = (targetUserId) => {
    navigate(`/messages/${targetUserId}`)
  }

  const handleSendMessage = async () => {
    if (!userId || (!text.trim() && !image)) {
      return
    }

    try {
      setSending(true)
      const token = await getToken()
      const formData = new FormData()

      formData.append('to_user_id', userId)
      formData.append('text', text.trim())

      if (image) {
        formData.append('image', image)
      }

      const { data } = await api.post('/api/message/send', formData, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (data.success) {
        dispatch(addMessage(data.message))
        setText('')
        setImage(null)
        fetchConversations({ showError: false })
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }

    setSending(false)
  }

  const renderConversationList = () => {
    if (loadingConversations) {
      return (
        <div className='flex-1 flex items-center justify-center text-sm text-slate-500'>
          Loading conversations...
        </div>
      )
    }

    if (filteredConversations.length === 0) {
      return (
        <div className='flex-1 flex items-center justify-center px-6 text-center text-sm text-slate-500'>
          No conversations found. Connect with someone and start chatting.
        </div>
      )
    }

    return (
      <div className='flex-1 overflow-y-auto'>
        {filteredConversations.map((conversation) => {
          const targetUserId = getEntityId(conversation.user)
          const isActive = targetUserId === userId

          return (
            <button
              key={targetUserId}
              onClick={() => handleConversationSelect(targetUserId)}
              className={`w-full border-b border-slate-100 px-4 py-3 text-left transition ${isActive ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
            >
              <div className='flex items-center gap-3'>
                <img
                  src={conversation.user?.profile_picture}
                  alt=''
                  className='h-12 w-12 rounded-full object-cover'
                />
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='min-w-0'>
                      <p className='truncate font-medium text-slate-900'>{conversation.user?.full_name}</p>
                      <p className='truncate text-xs text-slate-500'>@{conversation.user?.username}</p>
                    </div>
                    <div className='flex flex-col items-end gap-1'>
                      {conversation.lastMessage?.createdAt && (
                        <span className='text-[11px] text-slate-400'>
                          {moment(conversation.lastMessage.createdAt).fromNow()}
                        </span>
                      )}
                      {conversation.unreadCount > 0 && (
                        <span className='min-w-5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white'>
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className='mt-1 truncate text-sm text-slate-500'>
                    {getPreviewText(conversation.lastMessage, currentUser?._id)}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className='h-full bg-slate-50 p-3 md:p-6'>
      <div className='mx-auto flex h-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm'>
        <div className={`${userId ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-slate-200 md:w-[360px]`}>
          <div className='border-b border-slate-200 px-5 py-5'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <h1 className='text-2xl font-semibold text-slate-900'>Messages</h1>
                <p className='text-sm text-slate-500'>{conversations.length} chats</p>
              </div>
              <div className='rounded-full bg-slate-100 p-3 text-slate-500'>
                <MessageCircleMore className='h-5 w-5' />
              </div>
            </div>

            <div className='mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
              <Search className='h-4 w-4 text-slate-400' />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search chats'
                className='w-full bg-transparent text-sm outline-none placeholder:text-slate-400'
              />
            </div>
          </div>

          {renderConversationList()}
        </div>

        <div className={`${userId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#fcfcfd_0%,#f8fafc_100%)]`}>
          {selectedConversation ? (
            <>
              <div className='flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 md:px-6'>
                <button
                  onClick={() => navigate('/messages')}
                  className='rounded-full p-2 text-slate-500 hover:bg-slate-100 md:hidden'
                >
                  <ChevronLeft className='h-5 w-5' />
                </button>
                <img
                  src={selectedConversation.user?.profile_picture}
                  alt=''
                  className='h-11 w-11 rounded-full object-cover'
                />
                <div className='min-w-0'>
                  <p className='truncate font-semibold text-slate-900'>{selectedConversation.user?.full_name}</p>
                  <p className='truncate text-sm text-slate-500'>@{selectedConversation.user?.username}</p>
                </div>
              </div>

              <div className='flex-1 overflow-y-auto px-4 py-5 md:px-6'>
                <div className='mx-auto flex w-full max-w-3xl flex-col gap-3'>
                  {sortedMessages.length > 0 ? (
                    sortedMessages.map((message) => {
                      const isOwnMessage = getEntityId(message.from_user_id) === currentUser?._id

                      return (
                        <div
                          key={message._id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[78%] rounded-3xl px-4 py-3 shadow-sm ${isOwnMessage ? 'rounded-br-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'rounded-bl-md bg-white text-slate-800'}`}>
                            {message.message_type === 'image' && (
                              <img
                                src={message.media_url}
                                alt=''
                                className='mb-2 max-h-80 w-full rounded-2xl object-cover'
                              />
                            )}
                            {message.text && (
                              <p className='whitespace-pre-line text-sm leading-6'>{message.text}</p>
                            )}
                            <p className={`mt-2 text-[11px] ${isOwnMessage ? 'text-white/70' : 'text-slate-400'}`}>
                              {moment(message.createdAt).format('h:mm A')}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className='flex flex-1 items-center justify-center py-16 text-center text-sm text-slate-500'>
                      Start your conversation with @{selectedConversation.user?.username}.
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className='border-t border-slate-200 bg-white px-4 py-4 md:px-6'>
                <div className='mx-auto w-full max-w-3xl rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm'>
                  {image && (
                    <div className='mb-3 flex items-center justify-between rounded-2xl bg-white px-3 py-2'>
                      <div className='flex items-center gap-3'>
                        <img
                          src={URL.createObjectURL(image)}
                          alt=''
                          className='h-12 w-12 rounded-xl object-cover'
                        />
                        <p className='text-sm text-slate-600'>Photo ready to send</p>
                      </div>
                      <button
                        onClick={() => setImage(null)}
                        className='text-sm font-medium text-slate-500 hover:text-slate-700'
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <div className='flex items-end gap-3'>
                    <label className='cursor-pointer rounded-full p-2 text-slate-500 transition hover:bg-white'>
                      <ImageIcon className='h-5 w-5' />
                      <input
                        type='file'
                        accept='image/*'
                        hidden
                        onChange={(e) => setImage(e.target.files?.[0] || null)}
                      />
                    </label>

                    <textarea
                      rows={1}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      placeholder='Message...'
                      className='max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-slate-400'
                    />

                    <button
                      onClick={handleSendMessage}
                      disabled={sending || (!text.trim() && !image)}
                      className='rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 p-3 text-white transition disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      <SendHorizonal className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className='hidden h-full flex-1 items-center justify-center md:flex'>
              <div className='max-w-sm text-center'>
                <div className='mx-auto mb-5 flex h-18 w-18 items-center justify-center rounded-full bg-slate-100 text-slate-500'>
                  <MessageCircleMore className='h-8 w-8' />
                </div>
                <h2 className='text-2xl font-semibold text-slate-900'>Your messages</h2>
                <p className='mt-2 text-sm leading-6 text-slate-500'>
                  Pick a conversation from the left to start chatting in a more real-time, Instagram-style inbox.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Messages
