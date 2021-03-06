/*
* Copyright 2016 CareerBuilder, LLC
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
* 
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and limitations under the License.
*/
var express = require('express');
var router = express.Router();
var connection = require('../middleware/mysql');
var db_tools = require('../tools/db_tools.js');

router.get('/', function(req, res){
  connection.query("Select * from Errors where Acknowledged=0 Order by ID DESC", function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    return res.send({Success:true,  Results:results});
  });
});

router.delete('/:id', function(req, res){
  var id = req.params.id;
  connection.query("Update Errors Set Acknowledged=1 where ID=?", [id], function(err, result){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    return res.send({Success:true});
  });
});

router.post('/retry/:id', function(req, res){
  var id = req.params.id;
  var query = "Select users.*, `databases`.*, `errors`.Retryable from Errors Join Users ON Users.Username = errors.Username Join `Databases` ON `Databases`.Name = Errors.`Database` Where Errors.ID=?;";
  connection.query(query, [id], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    if(results.length <1 || results[0].Retryable === 0){
      return res.send({Success:false, Error:'No retryable Error with that ID'});
    }
    var data = results;
    connection.query("Update Errors set Acknowledged=1 where id=?", [id], function(err, results){
      if(err){
        console.log(err);
        return res.send({Success:false, Error:err});
      }
      db_tools.update_users(data[0], data, function(errs){});
      return res.send({Success:true});
    });
  });
});

router.post('/retry/', function(req, res){
  var query = "Select users.*, `databases`.*, `errors`.Retryable from Errors Join Users ON Users.Username = errors.Username Join `Databases` ON `Databases`.Name = Errors.`Database` Where Errors.Acknowledged=0 AND Errors.Retryable=1;";
  connection.query(query, function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    var databases = {};
    results.forEach(function(res, i){
      if(!(res.Name in databases)){
        databases[res.Name] = [];
      }
      databases[res.Name].push(res);
    });
    connection.query("Update Errors set Acknowledged=1 where ID>0", function(err, results){
      if(err){
        console.log(err);
        return res.send({Success:false, Error:err});
      }
      for (var db in databases) {
        if (databases.hasOwnProperty(db)){
          console.log("Retrying operations for " + databases[db][0].Name);
          db_tools.update_users(databases[db][0], databases[db], function(errs){});
        }
      }
      return res.send({Success:true});
    });
  });
});

module.exports=router;
