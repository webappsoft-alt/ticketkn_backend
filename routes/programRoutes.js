const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const authMiddleware = require('../middleware/auth');

router.post('/create', authMiddleware,programController.createPost);
router.put('/edit/:id',authMiddleware, programController.editPost);
router.post('/exercise/create', authMiddleware,programController.createExcercise);
router.post('/exercise/edit/:id', authMiddleware,programController.editExcercise);
router.get('/me/:type/:id',authMiddleware, programController.getPrograms);
router.get('/:type/:id?',authMiddleware, programController.filterPrograms);
router.get('/exercise/:program/:day/:id',authMiddleware, programController.getExcersie);
// router.post('/filter',authMiddleware, programController.filterPosts);
router.delete('/:id', authMiddleware, programController.deletePostById);

module.exports = router;
