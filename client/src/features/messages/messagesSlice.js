import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/axios'


const initialState = {
    messages: [],
    inboxRefreshKey: 0,
}

export const fetchMessages = createAsyncThunk('messages/fetchMessages', async ({token, userId}) => {
    const { data } = await api.post('/api/message/get', {to_user_id: userId}, {
        headers: { Authorization: `Bearer ${token}` }
    })
    return data.success ? data : null
})

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        setMessages: (state, action)=>{
            state.messages = action.payload;
        },
        addMessage: (state, action)=>{
            const exists = state.messages.some((message)=> message._id === action.payload._id)
            if(!exists){
                state.messages = [...state.messages, action.payload]
            }
        },
        resetMessages: (state)=>{
            state.messages = [];
        },
        bumpInboxRefresh: (state)=>{
            state.inboxRefreshKey += 1;
        },
    },
    extraReducers: (builder)=>{
        builder.addCase(fetchMessages.fulfilled, (state, action)=>{
            if(action.payload){
                state.messages = action.payload.messages
            }
        })
    }
})

export const {setMessages, addMessage, resetMessages, bumpInboxRefresh} = messagesSlice.actions;

export default messagesSlice.reducer
