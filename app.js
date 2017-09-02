// mongodb setup
const mongoose = require('mongoose');
const Schema = mongoose.Schema
mongoose.connect('<YOU CONNECTION STRING HERE!!!>');

// schemas of the documents
const BlogPostSchema = mongoose.Schema({
  Title: { type: String },
  Description: { type: String },

  // array defnition with the object reference from Comment
  Comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }] 
}); 

const CommentSchema = mongoose.Schema({
  // object reference from BlogPost
  BlogPost  : { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost' },
  Message: { type: String }
});

// "cascade triggers"
BlogPostSchema.pre('remove', function(next) { 
    // remove all commens with BlogPost id
    Comment.remove({ "BlogPost" : this._id }).exec(); 
    next();
});

CommentSchema.pre('remove', function(next) {
    // this will find locate the blog post
    BlogPost.findById(this.BlogPost).exec((error, item) => {
      // remove comment from array in the BlogPost
      var index = item.Comments.indexOf(item.Comments.find(e => e._id == this._id));
      item.Comments.splice(index, 1);
      item.save(() => { next(); });
    });
});

CommentSchema.pre('save', function(next) {
    // add comment in BlogPost array as well
    BlogPost.findById(this.BlogPost).exec((error, item) => {
      item.Comments.push(this);
      item.save(() => { next(); });
    });
});

// register schemas
const BlogPost = mongoose.model('BlogPost', BlogPostSchema);
const Comment = mongoose.model('Comment', CommentSchema);

// http server 
var express    = require('express');        
var app        = express();                 

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// endpoints
var router = express.Router();   

router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to api!' });   
});           

// POST BLOG ITEM
router.post('/blogPosts', function(req, res) {
    var entity = new BlogPost();     
    entity.Title = req.body.Title;   
    entity.Description = req.body.Description;    
    entity.save(function(error) {
        if (error)
            res.send(error);

        res.json({ message: 'created' });
    }); 
});    

// GET BLOG POSTS
router.get('/blogPosts', function(req, res) {
    BlogPost
        .find()
        .populate('Comments')
        .exec(function(err, entities) {
            if (err)
                res.send(err);

            res.json(entities);
        });
});   

// POST COMMENT
router.post('/comments', function(req, res) {
    var entity = new Comment();     
    entity.Message = req.body.Message;   
    entity.BlogPost = mongoose.Types.ObjectId(req.body.BlogPost);    
    entity.save(function(error) {
        if (error)
            res.send(error);

        res.json({ message: 'created' });
    }); 
});    

// GET COMMENTS
router.get('/comments', function(req, res) {
    Comment
        .find()
        .populate('BlogPost')
        .exec(function(err, entities) {
            if (err)
                res.send(err);

            res.json(entities);
        });
}); 

// GET COMMENTS BY BLOG ENTRY TITLE
router.get('/comments/:page/:blogPostTitle', function(req, res) {
    Comment
        .aggregate([
        // join BlogPost collection
        {
            $lookup: {
                from: 'blogposts', // special attention here, it is the name of the collection
                localField: 'BlogPost',
                foreignField: '_id',
                as: 'BlogPost'
            }
        },
        // convert array of BlogPost to object
        {
            $unwind: '$BlogPost'
        },
        // filter
        {
            $match: 
            { 
                "BlogPost.Title": new RegExp(req.params.blogPostTitle) 
            }
        },
        // pagination info
        { $sort: { "BlogPost.Title": 1 } },
        { $skip: (req.params.page * 10) - 10 }, // (page index * page size) - page size
        { $limit: 10 }
        ])
        .exec(function(err, entities) {
            if (err)
                res.send(err);

            res.json(entities);
        });
});

// register the routes
app.use('/', router);

// starting http server...
const port = 5000; 
app.listen(port);
console.log('listening port: ' + port);