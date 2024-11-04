const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const optionalAuth = require('../middleware/optionalAuth');
const authMiddleware = require('../middleware/auth');
const admin = require('../middleware/admin');

router.post('/create', authMiddleware,postController.createPost);
router.get('/fav/me/:id?',authMiddleware, postController.getMyFavPosts);
router.get('/purchases/:eventId/:id', authMiddleware, postController.eventsPurchases);
router.get('/purchase/all/:id', authMiddleware, postController.getPurchase);
// router.post('/admin/purchases/:id',[authMiddleware,admin], postController.getAdminPurchases);
// router.put('/admin/update-purchases/:id',[authMiddleware,admin], postController.updatePurchasePaymentByAdmin);
router.get('/admin/:type/:id',[authMiddleware,admin], postController.getAdminPost);
router.post('/filter',optionalAuth, postController.filterPosts);
router.get('/detail/:id',optionalAuth, postController.getDetailsEvent);
router.get('/no-coupon',optionalAuth, postController.noCouponEvent);
router.put('/purchase/:id',authMiddleware, postController.purchaseTicket);
router.post('/payment', postController.paymentDone);
router.put('/ticket/scan/:userId/:eventId',authMiddleware, postController.updatePurchaseScan);
router.get('/ticket/:userId/:eventId',optionalAuth, postController.getPurchaseTicket);
router.get('/me/latest',authMiddleware, postController.latestEvent);
router.get('/me/:id/:search?',authMiddleware, postController.getMyPosts);
router.put('/edit/:id',authMiddleware, postController.editPost);
router.delete('/:id', authMiddleware,postController.deletePostById);
router.put('/like/:id', authMiddleware,postController.likePost);

module.exports = router;
