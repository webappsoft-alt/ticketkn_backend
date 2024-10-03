const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const optionalAuth = require('../middleware/optionalAuth');
const authMiddleware = require('../middleware/auth');

router.post('/create', authMiddleware,postController.createPost);
router.get('/fav/me/:id?',authMiddleware, postController.getMyFavPosts);
router.get('/purchase/all/:id', authMiddleware, postController.getPurchase);
router.get('/admin/:type/:id',authMiddleware, postController.getAdminPost);
router.post('/filter',optionalAuth, postController.filterPosts);
router.put('/purchase/:id',authMiddleware, postController.purchaseTicket);
router.get('/ticket/:userId/:eventId',optionalAuth, postController.getPurchaseTicket);
router.get('/me/latest',authMiddleware, postController.latestEvent);
router.get('/me/:id/:search?',authMiddleware, postController.getMyPosts);
router.put('/edit/:id',authMiddleware, postController.editPost);
router.delete('/:id', authMiddleware,postController.deletePostById);
router.put('/like/:id', authMiddleware,postController.likePost);

module.exports = router;
