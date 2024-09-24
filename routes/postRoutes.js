const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const optionalAuth = require('../middleware/optionalAuth');
const authMiddleware = require('../middleware/auth');

router.post('/create', authMiddleware,postController.createPost);
router.get('/fav/me/:id?',authMiddleware, postController.getMyFavPosts);
router.post('/filter',optionalAuth, postController.filterPosts);
router.get('/me/:id/:search?',optionalAuth, postController.getMyPosts);
router.put('/edit/:id',authMiddleware, postController.editPost);
router.delete('/:id', authMiddleware,postController.deletePostById);
router.put('/like/:id', authMiddleware,postController.likePost);

module.exports = router;
