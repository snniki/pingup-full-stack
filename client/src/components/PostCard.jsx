import React, { useEffect, useState } from 'react'
import { BadgeCheck, Heart, MessageCircle } from 'lucide-react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const PostCard = ({ post }) => {
    const navigate = useNavigate()
    const { getToken } = useAuth()
    const currentUser = useSelector((state) => state.user.value)

    const [localPost, setLocalPost] = useState(post)
    const [showComments, setShowComments] = useState(false)
    const [commentText, setCommentText] = useState('')
    const [submittingComment, setSubmittingComment] = useState(false)

    useEffect(() => {
        setLocalPost(post)
    }, [post])

    const likes = localPost.likes_count || []
    const comments = localPost.comments || []
    const imageUrls = localPost.image_urls || []

    const postWithHashtags = (localPost.content || '').replace(
        /(#\w+)/g,
        '<span class="text-indigo-600">$1</span>'
    )

    const handleLike = async () => {
        try {
            const { data } = await api.post(
                '/api/post/like',
                { postId: localPost._id },
                { headers: { Authorization: `Bearer ${await getToken()}` } }
            )

            if (data.success) {
                toast.success(data.message)
                if (data.post) {
                    setLocalPost(data.post)
                }
            } else {
                toast(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleAddComment = async () => {
        const text = commentText.trim()

        if (!text) {
            return
        }

        try {
            setSubmittingComment(true)
            const { data } = await api.post(
                '/api/post/comment',
                { postId: localPost._id, text },
                { headers: { Authorization: `Bearer ${await getToken()}` } }
            )

            if (data.success) {
                toast.success(data.message)
                setLocalPost(data.post)
                setCommentText('')
                setShowComments(true)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }

        setSubmittingComment(false)
    }

    const handleCommentLike = async (commentId) => {
        try {
            const { data } = await api.post(
                '/api/post/comment/like',
                { postId: localPost._id, commentId },
                { headers: { Authorization: `Bearer ${await getToken()}` } }
            )

            if (data.success) {
                setLocalPost(data.post)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const sortedComments = [...comments].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    )

    return (
        <div className='bg-white rounded-xl shadow p-4 space-y-4 w-full max-w-2xl'>
            <div
                onClick={() => navigate('/profile/' + localPost.user._id)}
                className='inline-flex items-center gap-3 cursor-pointer'
            >
                <img
                    src={localPost.user.profile_picture}
                    alt=''
                    className='w-10 h-10 rounded-full shadow'
                />
                <div>
                    <div className='flex items-center space-x-1'>
                        <span>{localPost.user.full_name}</span>
                        <BadgeCheck className='w-4 h-4 text-blue-500' />
                    </div>
                    <div className='text-gray-500 text-sm'>
                        @{localPost.user.username} | {moment(localPost.createdAt).fromNow()}
                    </div>
                </div>
            </div>

            {localPost.content && (
                <div
                    className='text-gray-800 text-sm whitespace-pre-line'
                    dangerouslySetInnerHTML={{ __html: postWithHashtags }}
                />
            )}

            {!!imageUrls.length && (
                <div className='grid grid-cols-2 gap-2'>
                    {imageUrls.map((img, index) => (
                        <img
                            src={img}
                            key={index}
                            className={`w-full h-48 object-cover rounded-lg ${imageUrls.length === 1 ? 'col-span-2 h-auto' : ''}`}
                            alt=''
                        />
                    ))}
                </div>
            )}

            <div className='flex items-center gap-6 text-gray-600 text-sm pt-2 border-t border-gray-300'>
                <button
                    onClick={handleLike}
                    className='flex items-center gap-1 cursor-pointer'
                >
                    <Heart
                        className={`w-4 h-4 ${likes.includes(currentUser?._id) ? 'text-red-500 fill-red-500' : ''}`}
                    />
                    <span>{likes.length}</span>
                </button>

                <button
                    onClick={() => setShowComments((prev) => !prev)}
                    className='flex items-center gap-1 cursor-pointer'
                >
                    <MessageCircle className='w-4 h-4' />
                    <span>{comments.length}</span>
                </button>
            </div>

            {showComments && (
                <div className='border-t border-gray-200 pt-4 space-y-4'>
                    <div className='flex items-start gap-3'>
                        <img
                            src={currentUser?.profile_picture}
                            alt=''
                            className='w-9 h-9 rounded-full shadow'
                        />
                        <div className='flex-1 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3'>
                            <textarea
                                rows={2}
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleAddComment()
                                    }
                                }}
                                placeholder='Write a comment...'
                                className='w-full resize-none bg-transparent text-sm outline-none'
                            />
                            <div className='mt-3 flex items-center justify-between'>
                                <button
                                    onClick={() => setShowComments(false)}
                                    className='text-sm text-slate-500 hover:text-slate-700 cursor-pointer'
                                >
                                    Hide comments
                                </button>
                                <button
                                    disabled={submittingComment || !commentText.trim()}
                                    onClick={handleAddComment}
                                    className='rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer'
                                >
                                    Post
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className='space-y-4'>
                        {sortedComments.length > 0 ? (
                            sortedComments.map((comment) => {
                                const commentLikes = comment.likes_count || []

                                return (
                                    <div key={comment._id} className='flex items-start gap-3'>
                                        <img
                                            src={comment.user?.profile_picture}
                                            alt=''
                                            className='w-9 h-9 rounded-full shadow'
                                        />
                                        <div className='flex-1 rounded-2xl bg-slate-50 px-4 py-3'>
                                            <div className='flex items-start justify-between gap-3'>
                                                <div>
                                                    <button
                                                        onClick={() => navigate('/profile/' + comment.user?._id)}
                                                        className='flex items-center gap-2 cursor-pointer'
                                                    >
                                                        <span className='font-medium text-slate-900'>
                                                            {comment.user?.full_name}
                                                        </span>
                                                        <span className='text-sm text-slate-500'>
                                                            @{comment.user?.username}
                                                        </span>
                                                    </button>
                                                    <p className='mt-1 text-sm text-slate-700 whitespace-pre-line'>
                                                        {comment.text}
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => handleCommentLike(comment._id)}
                                                    className='flex items-center gap-1 text-sm text-slate-500 cursor-pointer'
                                                >
                                                    <Heart
                                                        className={`w-4 h-4 ${commentLikes.includes(currentUser?._id) ? 'text-red-500 fill-red-500' : ''}`}
                                                    />
                                                    <span>{commentLikes.length}</span>
                                                </button>
                                            </div>

                                            <div className='mt-2 text-xs text-slate-400'>
                                                {moment(comment.createdAt).fromNow()}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <p className='text-sm text-slate-500'>No comments yet. Start the conversation.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default PostCard
