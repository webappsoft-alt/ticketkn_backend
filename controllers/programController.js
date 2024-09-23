const Exercise = require("../models/Exercise");
const Program = require("../models/Program");

exports.createPost = async (req, res) => {
  try {
    const {
      name,
      description,
      image,
      numb_exercise,
      time,
      amount,
      type
    } = req.body;
    const userId = req.user._id;

    const program = new Program({
      user:userId,
      name,
      description,
      image,
      numb_exercise,
      time,
      amount,
      type
    });
    
    await program.save();
    res.status(200).json({success: true,message: "Program created successfully",program,});
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.editPost = async (req, res) => {
  try {
    const {
      name,
      description,
      image,
      numb_exercise,
      time,
      amount,
      days,
    } = req.body;
    const productId = req.params.id;
    const userId = req.user._id;

    // Create an object to store the fields to be updated
    let updateFields = Object.fromEntries(
      Object.entries({
        name,
        description,
        image,
        numb_exercise,
        time,
        amount,
        days,
      }).filter(([key, value]) => value !== undefined)
    );

    // Check if there are any fields to update
    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .send({
          success: false,
          message: "No valid fields provided for update.",
        });
    }

    const program = await Program.findOneAndUpdate(
      { _id: productId,user:userId },
      updateFields,
      { new: true }
    )

    if (!program)
      return res
        .status(404)
        .send({
          success: false,
          message: "The Program with the given ID was not found.",
        });

    res.send({success: true,message: "Program updated successfully",program: program,});
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.createExcercise = async (req, res) => {
  try {
    const {
      program,
      day,
      videourl,
      name,
      repetations,
    } = req.body;
    const userId = req.user._id;

    const exercise = new Exercise({
      program,
      day,
      videourl,
      name,
      repetations,
    });
    
    await exercise.save();
    res.status(200).json({success: true,message: "Exercise created successfully",exercise,});
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.editExcercise = async (req, res) => {
  try {
    const {
      videourl,
      name,
      repetations,
    } = req.body;
    const productId = req.params.id;
    const userId = req.user._id;

    // Create an object to store the fields to be updated
    let updateFields = Object.fromEntries(
      Object.entries({
        videourl,
        name,
        repetations,
      }).filter(([key, value]) => value !== undefined)
    );

    // Check if there are any fields to update
    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .send({
          success: false,
          message: "No valid fields provided for update.",
        });
    }

    const exercise = await Exercise.findOneAndUpdate(
      { _id: productId,user:userId },
      updateFields,
      { new: true }
    )

    if (!exercise)
      return res
        .status(404)
        .send({
          success: false,
          message: "The Exercise with the given ID was not found.",
        });

    res.send({success: true,message: "Exercise updated successfully",exercise: exercise,});
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// exports.getRequests = async (req, res) => {
 
//   let query = {};
//   const eventId = req.params.id;

//   if (req.params.lastId) {
//     query._id = { $lt: req.params.lastId };
//   }

//   const pageSize = 10;

//   query.status = req.params.status
//   query.event = eventId

//   const events = await JoinUser.find(query).populate("user").populate("event").sort({ _id: -1 }).limit(pageSize).lean();

//   res.send({ success: true, requests: events});
// };

// exports.getJoinPost = async (req, res) => {
 
//   let query = {};
//   const userId = req.user._id;

//   if (req.params.id) {
//     query._id = { $lt: req.params.id };
//   }

//   const pageSize = 10;

//   query.status='active'
//   query.joined={$in:userId}

//   const events = await Event.find(query).populate("likes").populate("conversation").populate("requests").populate({
//     path: 'joined',
//     options: { limit: 3 } // Limit to 3 users
//   }).populate("user").sort({ _id: -1 }).limit(pageSize).lean();
//   for (let post of events) {
//     post.likes = Array.isArray(post.likes) && post.likes.some((like) => like.user.toString() === userId.toString());
//     post.requests = Array.isArray(post.requests) ? post.requests.find((like) => like.user.toString() === userId.toString()) : undefined;
//     post.joinedCount = await JoinUser.countDocuments({event:post._id,status:"accepted"});
//   }

//   res.send({ success: events.length==0? false : true, events: events});
// };

exports.getPrograms = async (req, res) => {
 
  let query = {};
  const userId = req.user._id;

  const lastId = parseInt(req.params.id)||1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }


  query.status='active';
  query.user=userId;

  if (req.params.type!=='all') {
    query.type=req.params.type;
  }

  const pageSize = 10;

  const skip = Math.max(0, (lastId - 1)) * pageSize;


  const programs = await Program.find(query).sort({ _id: -1 }).skip(skip).limit(pageSize).lean()

  const totalCount = await Program.countDocuments(query);
  const totalPages = Math.ceil(totalCount / pageSize);

  res.send({ success: programs.length==0? false : true, programs: programs,count: { totalPage: totalPages, currentPageSize: programs.length } });
};

exports.filterPrograms = async (req, res) => {
 
  let query = {};
  const userId = req.user._id;

  
  if (req.params.id) {
    query._id = { $lt: req.params.id };
  }

  const pageSize = 10;

  query.status='active';

  if (req.params.type!=='all') {
    query.type=req.params.type;
  }

  const programs = await Program.find(query).sort({ _id: -1 }).sort({ _id: -1 }).limit(pageSize).lean();

  res.send({ success: programs.length==0? false : true, programs: programs });
};

exports.getExcersie = async (req, res) => {
 
  let query = {};
  const programId = req.params.program;
  const day = req.params.day;

  const lastId = parseInt(req.params.id)||1;

  // Check if lastId is a valid number
  if (isNaN(lastId) || lastId < 0) {
    return res.status(400).json({ error: 'Invalid last_id' });
  }

  query.program=programId;
  query.day=day;

  const pageSize = 10;

  const skip = Math.max(0, (lastId - 1)) * pageSize;


  const exercise = await Exercise.find(query).sort({ _id: -1 }).skip(skip).limit(pageSize).lean()

  const totalCount = await Exercise.countDocuments(query);
  const totalPages = Math.ceil(totalCount / pageSize);

  res.send({ success: events.length==0? false : true, exercise: exercise,count: { totalPage: totalPages, currentPageSize: exercise.length } });
};

exports.deletePostById = async (req, res) => {
  try {
    const postId = req.params.id;

    const program = await Program.findOneAndUpdate({ _id: postId },{ status:"deleted" },{ new:true });

    if (!program) {
      return res
        .status(404)
        .json({
          message:
            "Program not found or user does not have permission to delete it",
        });
    }

    res.status(200).json({ message: "Program deleted successfully", program: program });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
