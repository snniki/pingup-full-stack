import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import moment from 'moment'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useSelector } from 'react-redux'
import api from '../api/axios'
import toast from 'react-hot-toast'

const RecentMessages = () => {
    const [conversations, setConversations] = useState([])
    const { user } = useUser()
    const { getToken } = useAuth()
    const inboxRefreshKey = useSelector((state) => state.messages.inboxRefreshKey)

    const fetchRecentMessages = async ({ showError = true } = {}) => {
        try {
            const token = await getToken()
            const { data } = await api.get('/api/message/conversations', {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (data.success) {
                const recentConversations = data.conversations
                    .filter((conversation) => conversation.lastMessage)
                    .slice(0, 6)

                setConversations(recentConversations)
            } else if (showError) {
                toast.error(data.message)
            }
        } catch (error) {
            if (showError) {
                toast.error(error.message)
            }
        }
    }

    useEffect(() => {
        if (!user) {
            return
        }

        fetchRecentMessages()

        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchRecentMessages({ showError: false })
            }
        }, 30000)

        return () => clearInterval(interval)
    }, [user])

    useEffect(() => {
        if (user) {
            fetchRecentMessages({ showError: false })
        }
    }, [inboxRefreshKey, user])

    return (
        <div className='bg-white max-w-xs mt-4 p-4 min-h-20 rounded-md shadow text-xs text-slate-800'>
            <h3 className='font-semibold text-slate-800 mb-4'>Recent Messages</h3>
            <div className='flex flex-col max-h-56 overflow-y-scroll no-scrollbar'>
                {conversations.map((conversation) => {
                    const preview = conversation.lastMessage?.text?.trim() || (conversation.lastMessage?.message_type === 'image' ? 'Photo' : 'New message')

                    return (
                        <Link to={`/messages/${conversation.user._id}`} key={conversation.user._id} className='flex items-start gap-2 rounded-md py-2 hover:bg-slate-100'>
                            <img src={conversation.user.profile_picture} alt="" className='w-8 h-8 rounded-full'/>
                            <div className='w-full min-w-0'>
                                <div className='flex justify-between gap-2'>
                                    <p className='truncate font-medium'>{conversation.user.full_name}</p>
                                    {conversation.lastMessage?.createdAt && (
                                        <p className='text-[10px] text-slate-400'>{moment(conversation.lastMessage.createdAt).fromNow()}</p>
                                    )}
                                </div>
                                <div className='flex justify-between gap-2'>
                                    <p className='truncate text-gray-500'>{preview}</p>
                                    {conversation.unreadCount > 0 && (
                                        <p className='bg-indigo-500 text-white min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[10px]'>
                                            {conversation.unreadCount}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

export default RecentMessages
