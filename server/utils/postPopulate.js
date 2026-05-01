export const postPopulateOptions = [
    {
        path: 'user',
        select: 'full_name username profile_picture',
    },
    {
        path: 'comments.user',
        select: 'full_name username profile_picture',
    },
];

export const populatePostQuery = (query) => query.populate(postPopulateOptions);
