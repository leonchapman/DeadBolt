describe.only('db_tools', function(){
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var request = require('supertest');
  global.config = {DB:{}, kmskey: ""};
  var db_tools = rewire('../tools/db_tools.js');

  var mock_db = {
    query: function(){
      var sql_args = [];
      var args = [];
      for(var i=0; i<arguments.length; i++){
        args.push(arguments[i]);
      }
      var callback = args[args.length-1]; //last arg is callback
      if(args.length > 2){
        sql_args = args[1];
      }
      if(args[0].search(/insert\s+into\s+errors/i)>-1){
        if(sql_args[0].search(/error/i)>-1){
          return callback("DB Error");
        }
        return callback(null,{insertId: 1});
      }
      if(args[0].search(/select\s+users\.\*,\s+max/i)>-1){
        if(sql_args[0]==-1){
          return callback("DB Error");
        }
        return callback(null,[{Username: 'testuser', MySQL_Password:'password', SQL_Server_Password:'password', Permissions:'SU'}]);
      }
    }
  }

  var mock_sql_tools = {
    update_users: function(db, users, gospel_users, callback){
      return callback([]);
    }
  }

  var users =[
    {Username: 'UserAll', MySQL_Password:'pass', SQL_Server_Password: 'pass', Mongo_Password:'pass', Cassandra_Password:'pass'},
    {Username: 'NoMysql', SQL_Server_Password: 'pass', Mongo_Password:'pass', Cassandra_Password:'pass'},
    {Username: 'NoMSSQL', MySQL_Password:'pass', Mongo_Password:'pass', Cassandra_Password:'pass'},
    {Username: 'NoMongo', MySQL_Password:'pass', SQL_Server_Password: 'pass', Cassandra_Password:'pass'},
    {Username: 'NoCass', MySQL_Password:'pass', SQL_Server_Password: 'pass', Mongo_Password:'pass'}
  ];



  before(function(){
    db_revert = db_tools.__set__('connection', mock_db);
    tools1_revert = db_tools.__set__('mysql_tools', mock_sql_tools);
    tools2_revert = db_tools.__set__('mssql_tools', mock_sql_tools);
    quiet_revert = db_tools.__set__('console', {log:function(){}});
  });
  describe('#filter_users()', function(){
    var filter_users = db_tools.__get__('filter_users');
    var types = ['mysql', 'aurora', 'mssql', 'mongo', 'cassandra'];
    var fields = ['MySQL_Password', 'MySQL_Password', 'SQL_Server_Password', 'Mongo_Password', 'Cassandra_Password'];
    types.forEach(function(type, i){
      it('should filter users with no ' + type + ' password', function(done){
        filter_users(users, type, function(good_users){
          assert(good_users, 'No user list returned');
          assert(good_users.length, users.length-1, 'incorrect number of users');
          var field = fields[i];
          good_users.forEach(function(g_user){
            assert(g_user[field], 'No password!');
          });
          done();
        });
      });
    });
    it('should remove all users on invalid type', function(done){
      filter_users(users, 'invalid', function(good_users){
        assert.equal(good_users.length, 0, 'Non empty array returned');
        done();
      });
    });
  });
  describe('#save_errors()', function(){
    var save_errors = db_tools.__get__('save_errors');
    it('should callback with an empty array for null input', function(done){
      save_errors(null, function(err, results){
        assert(results.length<1, 'function returned something for nothing');
        done();
      });
    });
    it('should callback with an empty array for empty input', function(done){
      save_errors([], function(err, results){
        assert(results.length<1, 'function returned something for nothing');
        done();
      });
    });
    it('should return an error on db error', function(done){
      save_errors([{User:{Username:'erroruser'}, Database:{Name:'testdb'}, Error:{Title:'title', Detail:'details'}, Retryable:true, Class:'Warning'}], function(err, results){
        assert(err, 'No error on db error');
        done();
      });
    });
    it('should succeed on valid errors', function(done){
      save_errors([{User:{Username:'testuser'}, Database:{Name:'testdb'}, Error:{Title:'title', Detail:'details'}, Retryable:true, Class:'Warning'}], function(err, results){
        assert.equal(false, !!err, 'Error thrown!');
        done();
      });
    });
  });
  describe('#retry_errors', function(){
    var retry_errors = db_tools.__get__('retry_errors');
    var errors = [
      {
        User:{Username:'testuser'},
        Database:{Name:'testdb'},
        Error:{Title:'title', Detail:'details'},
        Retryable:true,
        Class:'Warning'
      },
      {
        User:{Username:'testuser'},
        Database:{Name:'testdb2'},
        Error:{Title:'title', Detail:'details'},
        Retryable:true,
        Class:'Error'
      },
    ];
    it('should handle empty errors list', function(done){
      retry_errors([], function(err, users, rem_errors){
        assert(users.length <1, 'Got a user from null errors');
        assert(rem_errors.length <1, 'Got a remainging error from null errors');
        done();
      });
    });
    it('should retry retryable errors', function(done){
      retry_errors(errors, function(err, users, rem_errors){
        assert(users, 'Did not return erroring users');
        assert(rem_errors, 'Did not return retryables');
        done();
      });
    });
    it('should save unretryable errors', function(done){
      errors.push({
              User:{Username:'erroruser'},
              Database:{Name:'testdb2'},
              Error:{Title:'title', Detail:'details'},
              Retryable:false,
              Class:'Error'
            });
      retry_errors(errors, function(err, users, rem_errors){
        assert(users, 'Did not return erroring users');
        assert(rem_errors, 'Did not return retryables');
        done();
      });
    });
  });
  describe('#update_users', function(){
    var update_users = db_tools.update_users;
    it('should return clean if no users are valid', function(done){
      update_users({Name: 'testdb', Type:'none'}, [], function(errors){
        assert.equal(false, !!errors, 'Errors returned!');
        done();
      });
    });
    it('should error on db error - gospel users', function(done){
      update_users({ID:-1, Name: 'testdb', Type:'mysql'}, [{Username: 'testguy', MySQL_Password:'password'}], function(errors){
        assert(errors, 'No Errors returned!');
        done();
      });
    });
    it('should try to update mysql servers', function(done){
      update_users({ID:1, Name: 'testdb', Type:'mysql'}, [{Username: 'testguy', MySQL_Password:'password'}], function(errors){
        assert(errors.length, 'No Errors object returned!');
        done();
      });
    });
  });
  after(function(){
    db_revert();
    tools1_revert();
    tools2_revert();
    quiet_revert();
  });
});