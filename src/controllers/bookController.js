const bookModel = require('../models/bookModel')
const userModel = require('../models/userModel')
const { default: mongoose } = require("mongoose")
const reviewModel = require('../models/reviewModel')
const aws= require("aws-sdk")

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


// let validObjectId = (id) => {
//     return mongoose.isValidObjectId(id)
// }


const keyValid = (key) => {
    if (typeof (key) === 'undefined' || typeof (key) === 'null') return true
    if (typeof (key) === 'string' && key.trim().length === 0) return true
    if (typeof (key) == 'number' && key.toString().trim().length == 0) return true
    return false
}

let isValidObjectId = (id) => {
    return mongoose.isValidObjectId(id)
}

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
aws.config.update({
    accessKeyId: "AKIAY3L35MCRUJ6WPO6J",
    secretAccessKey: "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",
    region: "ap-south-1"
})

let uploadFile= async ( file) =>{
   return new Promise( function(resolve, reject) {
    // this function will upload file to aws and return the link
    let s3= new aws.S3({apiVersion: '2006-03-01'}); // we will be using the s3 service of aws

    var uploadParams= {
        ACL: "public-read",
        Bucket: "classroom-training-bucket",  //HERE
        Key: "abc/" + file.originalname, //HERE 
        Body: file.buffer
    }


    s3.upload( uploadParams, function (err, data ){
        if(err) {
            return reject({"error": err})
        }
        console.log(data)
        console.log("file uploaded succesfully")
        return resolve(data.Location)
    })

    // let data= await s3.upload( uploadParams)
    // if( data) return data.Location
    // else return "there is an error"

   })
}


// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

const createBook = async (req, res) => {
    try {
        let data = req.body
        if (Object.keys(data).length == 0) return res.status(400).send({ status: false, message: "Please provide book details" })

        const { title, excerpt, userId, ISBN, category, subcategory, releasedAt } = data

        // ---------------Validation starts from here----------------
        if (!title) return res.status(400).send({ status: false, message: "Title is required" })
        if (keyValid(title)) return res.status(400).send({ status: false, message: "Invalid title" })
        const isTitle = await bookModel.findOne({ title: title, isDeleted: false })
        if (isTitle) return res.status(400).send({ status: false, message: "Title is already present" })

        if (!excerpt) return res.status(400).send({ status: false, message: "Excerpt is required" })
        if (keyValid(excerpt)) return res.status(400).send({ status: false, message: "Invalid excerpt" })

        if (!userId) return res.status(400).send({ status: false, message: "UserId is required" })
        if (!isValidObjectId(userId)) return res.status(400).send({ status: false, message: "Invalid userId" })
        const isUser = await userModel.findById({ _id: userId })
        if (!isUser) return res.status(400).send({ status: false, message: "No user found with the given id" })

        // -------------Checking the userId with the logged in userId to AUTHORIZE the user-------------------
        if (req.userId != userId) return res.status(401).send({ status: false, message: "UserId is not matched with your UserId while creating the book" })

        if (!ISBN) return res.status(400).send({ status: false, message: "ISBN is required" })
        if (keyValid(ISBN)) return res.status(400).send({ status: false, message: "invalid ISBN" })
        const isISBN = await bookModel.findOne({ ISBN: ISBN, isDeleted: false })
        if (isISBN) return res.status(400).send({ status: false, message: "ISBN is already present" })

        if (!category) return res.status(400).send({ status: false, message: "Category is required" })
        if (keyValid(category)) return res.status(400).send({ status: false, message: "Invalid category" })

        if (!subcategory) return res.status(400).send({ status: false, message: "Subcategory is required" })
        if (keyValid(subcategory)) return res.status(400).send({ status: false, message: "Invalid subcategory" })

        if (!releasedAt) return res.status(400).send({ status: false, message: "ReleasedAt is required" })
        if (keyValid(releasedAt)) return res.status(400).send({ status: false, message: "Invalid release date" })
        if (!/^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/.test(releasedAt)) return res.status(400).send({ status: false, message: "ReleasedAt Date Format should be YYYY-MM-DD " })
        // -----------------Validation ends here------------------

        // -----------------Validation ends here------------------
        let files= req.files
        if(files && files.length>0){
            //upload to s3 and get the uploaded link
            // res.send the link back to frontend/postman
            let uploadedFileURL= await uploadFile( files[0] ) 
             let obj = {
            userId:userId,
            category:category,
            subcategory:subcategory,
            bookCover:uploadedFileURL,
            title:title,
            excerpt:excerpt,
            ISBN:ISBN,
            releasedAt:releasedAt
        };
           /----------------------------create book ----------------------------/
        let savedData = await bookModel.create(obj)
        return res.status(201).send({ status: true, message: "success", data: savedData });
        }
        else{
           return res.status(400).send({ msg: "No file found" })
        }
    }
    catch (err) {
        res.status(500).send({ status: false, message: err.message })
    }
}

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

const getBooks = async (req, res) => {
    try {
        const requestBody = req.query;
        const filterQuery = { isDeleted: false }

        if (Object.keys(requestBody).length != 0) {
            if (requestBody.userId) {
                filterQuery.userId = requestBody.userId.trim()
            }
            if (requestBody.category) {
                filterQuery.category = requestBody.category.trim()
            }
            if (requestBody.subcategory) {
                filterQuery.subcategory = requestBody.subcategory.split(",").map(el => el.trim())
            }
        }

        let bookData = await bookModel.find(filterQuery).sort({ title: 1 }).select({ _id: 1, title: 1, excerpt: 1, userId: 1, category: 1, releasedAt: 1, reviews: 1 ,isDeleted:1 })
        if (bookData.length==0) return res.status(404).send({ status: false, msg: "No Book found" })

        return res.status(200).send({ status: true, data: bookData })

    } catch (err) {
        res.status(500).send({ status: false, Error: err.message })
    }
}

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

const getBookById = async function (req, res) {
    try {
        const bookId = req.params.bookId

        if (!validObjectId(bookId)) return res.status(400).send({ status: false, message: "Invalid BookId" })

        const bookData = await bookModel
            .findOne({ _id: bookId, isDeleted: false })
            .select({ title: 1, excerpt: 1, userId: 1, category: 1, releasedAt: 1, reviews: 1 })

        if (!bookData) return res.status(404).send({ status: false, message: "Book is not found or book is deleted" })

        // --------Finding all reviews for the book----------
        const reviewsData = await reviewModel.find({ bookId: bookId, isDeleted: false })

        // ---------adding reviewsData with bookData-----------
        let bookDataWithReviews = JSON.parse(JSON.stringify(bookData))
        bookDataWithReviews.reviewsData = reviewsData

        // let bookDataWithReviews={
        //     title:bookData.title,
        //     excerpt:bookData.excerpt,
        //     ........................
        //     ........................
        //     reviewsData:reviewsData
        // }

        return res.status(200).send({ status: true, data: bookDataWithReviews })
    }
    catch (err) {
        res.status(500).send({ status: false, message: err.message })
    }
}

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

const updateBook = async function (req, res) {
    try {
        const data = req.body
        const bookId = req.params.bookId

        if (!validObjectId(bookId)) return res.status(400).send({ status: false, message: "Invalid BookId" })

        if (Object.keys(data).length == 0) return res.status(400).send({ status: false, message: "Please provide some data to update..!!" })

        const { title, ISBN, excerpt, releasedAt } = data

        // ----------------Validation starts from here---------------
        if (title!=undefined) {
            if (keyValid(title)) return res.status(400).send({ status: false, message: "Invalid title" })
            const isTitle = await bookModel.findOne({ title: data.title, isDeleted: false })
            if (isTitle) return res.status(400).send({ status: false, message: "Title is aready present is the DataBase..!!" })
        }
        if (ISBN!=undefined) {
            if (keyValid(ISBN)) return res.status(400).send({ status: false, message: "Invalid ISBN" })
            const isISBN = await bookModel.findOne({ ISBN: data.ISBN, isDeleted: false })
            if (isISBN) return res.status(400).send({ status: false, message: "ISBN is already present in the DataBase..!!" })
        }
        if (excerpt!=undefined) {
            if (keyValid(excerpt)) return res.status(400).send({ status: false, message: "Invalid excerpt" })
        }
        // -----------------Validation ends here--------------------

        const updatingData = await bookModel.findByIdAndUpdate({ _id: bookId }, { ...data }, { new: true })
        res.status(200).send({ status: true, data: updatingData })
    }
    catch (err) {
        res.status(500).send({ status: false, message: err.message })
    }
}

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

const deleteBookById = async function (req, res) {
    try {
        let bookId = req.params.bookId
        if (!validObjectId(bookId)) return res.status(400).send({ status: false, msg: "Invalid BookId" })

        let bookData = await bookModel.findOne({ _id: bookId, isDeleted: false })

        if (!bookData) return res.status(404).send({ status: false, msg: "Book not found or book is already deleted" })

        // -------Adding isDeleted and deletedAt key in bookData----------
        bookData.isDeleted = true
        bookData.deletedAt = new Date()
        bookData.save()

        res.status(200).send({ status: true, msg: "Data deleted succesfully", data: bookData })
    }
    catch (err) {
        return res.status(500).send({ status: false, err: err.message })
    }
}

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

module.exports = { createBook, getBooks, getBookById, deleteBookById, updateBook }