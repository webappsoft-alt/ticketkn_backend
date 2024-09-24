const Post = require('../models/Event');
const like = require('../models/like');

exports.createPost = async (req, res) => {
  try {
    const { 
      images,
      name,
      event_type,
      start_Date,
      start_Time,
      address,
      country,
      city,
      state,
      description,
      join_people,
      ticket_plans,
      refund_policy,
      location
     } = req.body;
    const userId = req.user._id;

    const post = new Post({
      user: userId,
      images,
      name,
      event_type,
      start_Date,
      start_Time,
      address,
      country,
      city,
      state,
      description,
      join_people,
      ticket_plans,
      refund_policy,
      location
    })

    await post.save();
    res.status(201).json({ success: true, message: 'Post created successfully', post });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.editPost = async (req, res) => {
  try {
    const userId = req.user._id;

    const { 
      images,
      name,
      event_type,
      start_Date,
      start_Time,
      address,
      country,
      city,
      state,
      description,
      join_people,
      ticket_plans,
      refund_policy,
      location 
    } = req.body;
    const postId = req.params.id;

    // Create an object to store the fields to be updated
  let updateFields = Object.fromEntries(
    Object.entries({
      images,
      name,
      event_type,
      start_Date,
      start_Time,
      address,
      country,
      city,
      state,
      description,
      join_people,
      ticket_plans,
      refund_policy,
      location 
    }).filter(([key, value]) => value !== undefined)
  );

  // Check if there are any fields to update
  if (Object.keys(updateFields).length === 0) {
    return res.status(400).send({ success: false, message: 'No valid fields provided for update.' });
  }
    const post = await Post.findOneAndUpdate({_id:postId}, updateFields, {
      new: true
    });

    if (!post) return res.status(404).send({ success: false, message: 'The Post with the given ID was not found.' });

    res.send({ success: true, message: 'Post updated successfully', post:singlePost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getMyPosts = async (req, res) => {
  const lastId = parseInt(req.params.id)||1;
  const userId = req?.user?._id||""

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  let query = {};
  query.status='active'


  const users = await Post.find(query).populate("user").populate("likes").sort({ _id: -1 }).skip(skip).limit(pageSize).lean();
  for (let posts of users) {
    posts.TotalLikes = posts?.likes?.length || 0
    posts.likes = Array.isArray(posts.likes) && posts.likes.some(like => like.user.toString() === userId.toString());
  }
  
  const totalCount = await Post.find(query);
  const totalPages = Math.ceil(totalCount.length / pageSize);
  
  res.send({ success: true, posts: users,count: { totalPage: totalPages, currentPageSize: users.length } });
};

exports.filterPosts = async (req, res) => {
  const lastId = parseInt(req.body.last_id)||1;
  const userId = req?.user?._id||""

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }

  const pageSize = 10;
  
  const skip = Math.max(0, (lastId - 1)) * pageSize;
  let query = {};

  query.status='active'

  if (req.body.search) {
    query.name= { $regex: new RegExp(req.body.search, 'i') };
  }

  if (req.body.today=="true"||req.body.today==true) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  query.createdAt= {
    $gte: today,
    $lt: tomorrow
  }
  }

  if (req.body.otherId) {
    query.user = req.body.otherId; 
  }

  if (req.body.address) {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(404).send({ message: 'Latitude and Longitude are required' });
    }

    const radiusInMiles = 20;
    const radiusInMeters = radiusInMiles * 1609.34; // Convert miles to meters
  
    const users = await Post.find({
      ...query,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radiusInMeters
        }
      }
    })
    .populate("user").populate("likes").skip(skip).limit(pageSize).lean();

    for (const post of users) {
      post.TotalLikes = post?.likes?.length || 0
      post.likes =userId? Array.isArray(post.likes) && post.likes.some(like => like.user.toString() === userId.toString()):false;
    }
    
    const totalCount = await Post.find({...query,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radiusInMeters
        }
      }
  });
    const totalPages = Math.ceil(totalCount.length / pageSize);
    
    res.send({ success: true, posts: users,count: { totalPage: totalPages, currentPageSize: users.length } });
  }else{

  const users = await Post.find(query).populate("user").populate("likes").sort({ _id: -1 }).skip(skip).limit(pageSize).lean();
  for (const post of users) {
    post.TotalLikes = post?.likes?.length || 0
    post.likes =userId? Array.isArray(post.likes) && post.likes.some(like => like.user.toString() === userId.toString()):false;
  }
  
  const totalCount = await Post.find(query);
  const totalPages = Math.ceil(totalCount.length / pageSize);
  
  res.send({ success: true, posts: users,count: { totalPage: totalPages, currentPageSize: users.length } });
}};


exports.deletePostById = async (req, res) => {
  try {
    const postId = req.params.id;

    const deletedPost = await Post.findOneAndUpdate({ _id: postId },{status:'deleted'},{new:true});

    if (!deletedPost) {
      return res.status(404).json({ message: 'Post not found or user does not have permission to delete it' });
    }

    res.status(200).json({ message: 'Post deleted successfully', post: deletedPost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


exports.likePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const existingLike = await like.findOne({ user: userId, event: postId });

    if (existingLike) {
      return await dislike(postId, res, userId);
    }
    const likePost = new like({
      user: userId,
      post: postId
    });


    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $push: { likes: likePost._id } },
      { new: true }
    ).populate("user")

    if (!updatedPost) {
      return res.status(404).json({ message: 'Post not found' });
    }

    await likePost.save()

    res.status(200).json({ message: 'Like added successfully', post: updatedPost });
  } catch (error) {

    console.log(error)
    res.status(500).json({ message: 'Internal server error' });
  }
};

const dislike = async (postId, res, userId) => {
  try {

    const deletedLike = await like.findOneAndDelete({ event: postId,user: userId, });

    if (!deletedLike) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $pull: { likes: deletedLike._id } },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.status(200).json({ message: 'Like deleted successfully', post: updatedPost });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};


exports.getMyFavPosts = async (req, res) => {
  const userId = req.user._id
  const lastId = parseInt(req.params.id)||1;

    // Check if lastId is a valid number
    if (isNaN(lastId) || lastId < 0) {
      return res.status(400).json({ error: 'Invalid last_id' });
    }
    let query={};
  
    const pageSize = 10;
    
    const skip = Math.max(0, (lastId - 1)) * pageSize;

  query.user = userId;
  try {
    const likedJobs = await like.find(query)
      .populate({
        path: 'event',
        populate: [
          { path: 'user', model: 'user' },
        ]
      }).sort({ _id: -1 }).skip(skip).limit(pageSize).lean();

      const totalCount = await like.find(query);
      const totalPages = Math.ceil(totalCount.length / pageSize);
    

    const jobs = likedJobs.map((like) => like.post);
    if (jobs.length > 0) {
      const UpdateFav = jobs.map(order => {
        return {
          ...order,       // Spread operator to copy existing properties
          likes: true // Adding new key with a value
        };
      });
      res.status(200).json({ success: true, posts: UpdateFav,count: { totalPage: totalPages, currentPageSize: jobs.length }  });
    } else {
      res.status(200).json({ success: false, message: 'No more favorite posts found',posts:[] ,count: { totalPage: totalPages, currentPageSize: jobs.length } });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};



