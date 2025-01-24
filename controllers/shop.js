const Product = require('../models/product');
const Order = require('../models/order');
const Visitor = require('../models/visitor');

exports.getProducts = (req, res, next) => {
  Product.find()
    .then(products => {
      console.log(products);
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products'
      });
    })
    .catch(err => {
      console.log(err);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => console.log(err));
};


exports.getIndex = async (req, res, next) => {
  //const user=req.body.email;
  try {
    let visitors = await Visitor.findOne({ name: 'counter' });
    //console.log('this is user',user);
    // If the app is being visited for the first time, so no records
    if(visitors.count%5==0)
    {
      console.log('congratualtion you have acheived milestone',visitors.count);
      //res.send('<h1> Hey you have reached maximum </h2>')
    }
    if (visitors == null) {
      // Creating a new default record
      const beginCount = new Visitor({
        name: 'counter',
        count: 1
      });
      

      // Saving in the database
      await beginCount.save();

      // Sending the count of visitor to the browser
      //res.send(`<h2>Counter: ` + 1 + '</h2>');

      // Logging when the app is visited first time
      console.log("First visitor arrived");
    } else {
      // Incrementing the count of visitor by 1
      visitors.count += 1;

      // Saving to the database
      await visitors.save();

      // Sending the count of visitor to the browser
      ////res.send(`<h2>Counter: ` + visitors.count + '</h2>');

      // Logging the visitor count in the console
      console.log("Visitor arrived: ", visitors.count);
    }

    // Fetching products and rendering the shop page
    const products = await Product.find();
    res.render('shop/index', {
      prods: products,
      pageTitle: 'Shop',
      path: '/'
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
// exports.getIndex = (req, res, next) => {
//   let visitors = await Visitor.findOne({name: 'localhost'})

//     // If the app is being visited first
//     // time, so no records
//     if(visitors == null) {
        
//         // Creating a new default record
//         const beginCount = new Visitor({
//             name : 'localhost',
//             count : 1
//         })

//         // Saving in the database
//         beginCount.save()

//         // Sending the count of visitor to the browser
//         res.send(`<h2>Counter: `+1+'</h2>')

//         // Logging when the app is visited first time
//         console.log("First visitor arrived")
//     }
//     else{
        
//         // Incrementing the count of visitor by 1
//         visitors.count += 1;

//         // Saving to the database
//         visitors.save()

//         // Sending the count of visitor to the browser
//         res.send(`<h2>Counter: `+visitors.count+'</h2>')

//         // Logging the visitor count in the console
//         console.log("visitor arrived: ",visitors.count)
//     }



//   //end code
//   Product.find()
//     .then(products => {
//       res.render('shop/index', {
//         prods: products,
//         pageTitle: 'Shop',
//         path: '/'
//       });
//     })
//     .catch(err => {
//       console.log(err);
//     });
// };

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err => console.log(err));
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      console.log(result);
      res.redirect('/cart');
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => console.log(err));
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => console.log(err));
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => console.log(err));
};

// exports.getHomePage=(req,res,next)=>{
//   Counter.findOne()
//   .then(counter => {
//     if (!counter) {
//       counter = new Counter();
//     }
//     counter.count++;
//     return counter.save();
//   })
//   .then(counter => {
//     console.log(`Page visit count: ${counter.count}`);
//     res.render('index', { count: counter.count });
//   })
//   .catch(err => {
//     console.error('Error fetching or updating counter:', err);
//     next(err);
//   });
//   }
