const fs=require('fs');
const path = require('path');
const stripe=require('stripe')('sk_test_51QofYlP7AgxDW3pFNmLQqdYJvVMnnYbMnIyUErk8Rx2DvYgoXmIOqoXSximwk7zhPcka6YYKrp6mzSflZAl4i2e4001xibo7eS');
const Product = require('../models/product');
const Order = require('../models/order');
const Visitor = require('../models/visitor');
const PDFDocument = require('pdfkit');

const { skipMiddlewareFunction } = require('mongoose');
const ITEMS_PER_PAGE = 2;

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
  try {
    let visitors = await Visitor.findOne({ name: 'counter' });

    if (visitors && visitors.count % 5 === 0) {
      console.log('Congratulations! You have achieved a milestone:', visitors.count);
    }

    if (!visitors) {
      const beginCount = new Visitor({
        name: 'counter',
        count: 1
      });
      await beginCount.save();
      console.log("First visitor arrived");
    } else {
      visitors.count += 1;
      await visitors.save();
      console.log("Visitor arrived:", visitors.count);
    }

    const page = req.query.page || 1;
    //const ITEMS_PER_PAGE = 10; // Define your items per page
    let totalItems;

    Product.find()
      .countDocuments()
      .then(numProducts => {
        totalItems = numProducts;
        return Product.find()
          .skip((page - 1) * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE);
      })
      .then(products => {
        res.render('shop/index', {
          prods: products,
          pageTitle: 'Shop',
          path: '/',
          currentPage: page,
          hasNextPage: ITEMS_PER_PAGE * page < totalItems,
          hasPreviousPage: page > 1,
          nextPage: page + 1,
          previousPage: page - 1,
          lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
        });
      })
      .catch(err => {
        console.error(err);
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  } catch (err) {
    console.error(err);
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  }
};

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

exports.getCheckout = (req, res, next) => {
  let products;
  let total = 0;
  req.user
    .populate('cart.items.productId')
    .then(user => {
      products = user.cart.items;
      total = 0;
      products.forEach(p => {
        total += p.quantity * p.productId.price;
      });

      return stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: products.map(p => {
          return {
            price_data: {
              currency: 'usd',
              product_data: {
                name: p.productId.title,
                description: p.productId.description,
              },
              unit_amount: p.productId.price * 100,
            },
            quantity: p.quantity
          };
        }),
        mode: 'payment', // Add this line
        success_url: req.protocol + '://' + req.get('host') + '/checkout/success',
        cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'
      });
    })
    .then(session => {
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: products,
        totalSum: total,
        sessionId: session.id
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};


exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    //.execPopulate()
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
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
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


exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('No order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }
      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);
      const pdfDoc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + invoiceName + '"'
      );
      
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);
      pdfDoc.fontSize(26).text('Invoice', {
        underline: true
      }); 
       pdfDoc.text('-----------------------');
       let totalPrice = 0;
      order.products.forEach(prod => {  
        totalPrice += prod.quantity * prod.product.price;
        pdfDoc.fontSize(14).text(
          prod.product.title +
            ' - ' +
            prod.quantity +
            ' x ' +
            '$' +
            prod.product.price
        );
      });
      pdfDoc.fontSize(26).text('TotalPrice: Rs'+totalPrice);
        pdfDoc.end();

      // fs.readFile(invoicePath, (err, data) => {
      //   if (err) {
      //     return next(err);
      //   }
      //   res.setHeader('Content-Type', 'application/pdf');
      //   res.setHeader(
      //     'Content-Disposition',
      //     'inline; filename="' + invoiceName + '"'
      //   );
      //   res.send(data);
      // });

    //   const file = fs.createReadStream(invoicePath);
    //   res.setHeader('Content-Type', 'application/pdf');
    //   res.setHeader(
    //     'Content-Disposition',
    //     'inline; filename="' + invoiceName + '"'
    //   );
    //   file.pipe(res);
     })
    .catch(err => next(err));
};

